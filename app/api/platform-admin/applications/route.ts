import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

async function getAdminClient() {
  const authClient = await createServerSupabaseClient();
  const { data: { user }, error } = await authClient.auth.getUser();
  const allowedIds = (process.env.PLATFORM_ADMIN_USER_IDS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  const allowedEmails = (process.env.PLATFORM_ADMIN_EMAILS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  const allowed = !!user && (allowedIds.includes(user.id.toLowerCase()) || (!!user.email && allowedEmails.includes(user.email.toLowerCase())));
  if (error || !allowed) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server-side Supabase service role is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
  try {
    const admin = await getAdminClient();
    if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    const { data, error } = await admin.from("business_applications").select("id,business_name,owner_name,email,phone,business_type,location,status,admin_notes,created_at").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ applications: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load applications." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminClient();
    if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const action = body.action;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
    if (!id || !["approve", "reject"].includes(action)) return NextResponse.json({ error: "Invalid application action." }, { status: 400 });

    const { data: application, error: findError } = await admin.from("business_applications").select("*").eq("id", id).single();
    if (findError || !application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (application.status !== "pending") return NextResponse.json({ error: "This application has already been reviewed." }, { status: 409 });

    if (action === "reject") {
      const { error } = await admin.from("business_applications").update({ status: "rejected", admin_notes: notes, reviewed_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, message: "Application rejected." });
    }

    const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(application.email, {
      data: { business_name: application.business_name, owner_name: application.owner_name, account_type: "business_owner" },
      redirectTo: `${request.nextUrl.origin}/update-password`,
    });
    if (inviteError || !invitation.user) return NextResponse.json({ error: inviteError?.message || "Could not create the owner invitation." }, { status: 400 });

    const ownerId = invitation.user.id;
    const { error: membershipError } = await admin.from("business_memberships").insert({
      owner_id: ownerId,
      user_id: ownerId,
      role: "owner",
      active: true,
    });
    if (membershipError) {
      await admin.auth.admin.deleteUser(ownerId);
      return NextResponse.json({ error: membershipError.message }, { status: 400 });
    }

    const { error: updateError } = await admin.from("business_applications").update({
      status: "approved",
      admin_notes: notes,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id).eq("status", "pending");
    if (updateError) {
      await admin.from("business_memberships").delete().eq("owner_id", ownerId).eq("user_id", ownerId);
      await admin.auth.admin.deleteUser(ownerId);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Approved. An account invitation has been sent to ${application.email}.` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review application." }, { status: 500 });
  }
}