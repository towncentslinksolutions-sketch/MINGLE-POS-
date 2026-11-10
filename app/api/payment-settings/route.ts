import { NextRequest, NextResponse } from "next/server";
import { createCipheriv, randomBytes } from "crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server-side Supabase service role key is not configured.");
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getOwnerContext() {
  const auth = await createServerSupabaseClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { ownerId: null, admin: null, response: NextResponse.json({ error: "Please sign in again." }, { status: 401 }) };
  const admin = getAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("business_memberships").select("role, active")
    .eq("owner_id", user.id).eq("user_id", user.id).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership || !membership.active || membership.role !== "owner") {
    return { ownerId: null, admin: null, response: NextResponse.json({ error: "Only the business owner can manage payment settings." }, { status: 403 }) };
  }
  return { ownerId: user.id, admin, response: null };
}

function encryptSecret(value: string) {
  const encodedKey = process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
  if (!encodedKey) throw new Error("Payment credentials encryption key is not configured in Vercel.");
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new Error("Payment credentials encryption key must decode to exactly 32 bytes.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export async function GET() {
  try {
    const context = await getOwnerContext();
    if (context.response) return context.response;
    const { data, error } = await context.admin!.from("business_payment_settings")
      .select("mpesa_shortcode, daraja_environment, enabled")
      .eq("owner_id", context.ownerId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ settings: data || null });
  } catch (error) {
    console.error("[payment-settings] GET failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load payment settings." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getOwnerContext();
    if (context.response) return context.response;
    const body = await request.json();
    const shortcode = String(body?.mpesa_shortcode || "").trim();
    const environment = String(body?.daraja_environment || "sandbox");
    const consumerKey = String(body?.consumer_key || "").trim();
    const consumerSecret = String(body?.consumer_secret || "").trim();
    const passkey = String(body?.passkey || "").trim();
    if (!shortcode || !consumerKey || !consumerSecret || !passkey) {
      return NextResponse.json({ error: "Enter the Paybill shortcode, Consumer Key, Consumer Secret and Passkey." }, { status: 400 });
    }
    if (!["sandbox", "production"].includes(environment)) {
      return NextResponse.json({ error: "Choose a valid Daraja environment." }, { status: 400 });
    }
    const { error } = await context.admin!.from("business_payment_settings").upsert({
      owner_id: context.ownerId,
      mpesa_shortcode: shortcode,
      daraja_environment: environment,
      consumer_key_encrypted: encryptSecret(consumerKey),
      consumer_secret_encrypted: encryptSecret(consumerSecret),
      passkey_encrypted: encryptSecret(passkey),
      enabled: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_id" });
    if (error) throw error;
    return NextResponse.json({ success: true, message: "M-Pesa credentials encrypted and saved. Payments remain disabled until the Daraja integration is completed and tested." });
  } catch (error) {
    console.error("[payment-settings] PUT failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save payment settings." }, { status: 500 });
  }
}
