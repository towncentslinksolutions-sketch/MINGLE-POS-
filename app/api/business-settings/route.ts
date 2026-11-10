import { NextRequest, NextResponse } from "next/server";
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
    return { ownerId: null, admin: null, response: NextResponse.json({ error: "Only the business owner can manage business settings." }, { status: 403 }) };
  }
  return { ownerId: user.id, admin, response: null };
}

const fields = [
  "business_name", "logo_url", "business_phone", "business_email", "business_address",
  "support_phone", "support_email", "support_whatsapp", "currency", "receipt_footer", "return_policy"
] as const;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  try {
    const context = await getOwnerContext();
    if (context.response) return context.response;
    const { data, error } = await context.admin!.from("business_settings")
      .select("business_name, logo_url, business_phone, business_email, business_address, support_phone, support_email, support_whatsapp, currency, tax_rate, receipt_footer, return_policy")
      .eq("owner_id", context.ownerId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ settings: data || null });
  } catch (error) {
    console.error("[business-settings] GET failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load business settings." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getOwnerContext();
    if (context.response) return context.response;
    const body = await request.json();
    const values: Record<string, string> = {};
    for (const field of fields) values[field] = clean(body?.[field], field === "receipt_footer" || field === "return_policy" ? 1000 : field === "business_address" ? 500 : 180);
    const currency = String(values.currency || "KES").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: "Enter a valid three-letter currency code, such as KES." }, { status: 400 });
    const taxRate = body?.tax_rate === "" || body?.tax_rate == null ? 0 : Number(body.tax_rate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      return NextResponse.json({ error: "Tax rate must be between 0 and 100." }, { status: 400 });
    }
    values.currency = currency;
    const { error } = await context.admin!.from("business_settings").upsert({
      owner_id: context.ownerId, ...values, tax_rate: taxRate, updated_at: new Date().toISOString(),
    }, { onConflict: "owner_id" });
    if (error) throw error;
    return NextResponse.json({ success: true, message: "Business settings saved successfully." });
  } catch (error) {
    console.error("[business-settings] PUT failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save business settings." }, { status: 500 });
  }
}
