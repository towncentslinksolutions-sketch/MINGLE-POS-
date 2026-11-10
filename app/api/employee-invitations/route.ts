import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
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
    return { ownerId: null, admin: null, response: NextResponse.json({ error: "Only the business owner can manage the shared employee link." }, { status: 403 }) };
  }
  return { ownerId: user.id, admin, response: null };
}

export async function GET() {
  try {
    const context = await getOwnerContext();
    if (context.response) return context.response;
    const { data, error } = await context.admin!.from("employee_invite_links")
      .select("active").eq("owner_id", context.ownerId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ active: Boolean(data?.active) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check invitation link." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext();
    if (context.response) return context.response;
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { error } = await context.admin!.from("employee_invite_links").upsert({
      owner_id: context.ownerId, token_hash: tokenHash, active: true, updated_at: new Date().toISOString(),
    }, { onConflict: "owner_id" });
    if (error) throw error;
    return NextResponse.json({ link: new URL(`/join/${token}`, request.nextUrl.origin).toString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create invitation link." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const context = await getOwnerContext();
    if (context.response) return context.response;
    const { error } = await context.admin!.from("employee_invite_links")
      .update({ active: false, updated_at: new Date().toISOString() }).eq("owner_id", context.ownerId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to revoke invitation link." }, { status: 500 });
  }
}
