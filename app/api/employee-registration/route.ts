import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";

    if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return NextResponse.json({ error: "This invitation link is invalid." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!fullName || fullName.length > 100) return NextResponse.json({ error: "Enter your name (maximum 100 characters)." }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error("Server-side Supabase service role key is not configured.");
    const admin = createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: invitation, error: lookupError } = await admin.from("employee_invite_links")
      .select("owner_id").eq("token_hash", tokenHash).eq("active", true).maybeSingle();
    if (lookupError) throw lookupError;
    if (!invitation) return NextResponse.json({ error: "This shared invitation link has expired or been disabled. Ask the business owner for a new link." }, { status: 410 });

    const { data: ownerMembership, error: ownerError } = await admin.from("business_memberships")
      .select("user_id").eq("owner_id", invitation.owner_id).eq("user_id", invitation.owner_id).eq("role", "owner").eq("active", true).maybeSingle();
    if (ownerError) throw ownerError;
    if (!ownerMembership) return NextResponse.json({ error: "This business invitation is no longer active." }, { status: 410 });

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, account_type: "employee", business_owner_id: invitation.owner_id },
      redirectTo: `${request.nextUrl.origin}/update-password`,
    });
    if (inviteError || !invited.user) {
      return NextResponse.json({ error: inviteError?.message || "Could not send the account invitation." }, { status: 400 });
    }

    const { error: membershipError } = await admin.from("business_memberships").insert({
      owner_id: invitation.owner_id, user_id: invited.user.id, role: "cashier", active: true,
    });
    if (membershipError) {
      await admin.auth.admin.deleteUser(invited.user.id);
      return NextResponse.json({ error: membershipError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `A secure account setup email has been sent to ${email}. Open that email to set your password and sign in to MINGLE POS.` }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to register employee." }, { status: 500 });
  }
}
