import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

function isPlatformAdmin(userId: string) {
  const allowedIds = (process.env.PLATFORM_ADMIN_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowedIds.includes(userId);
}

async function getAuthorizedAdmin() {
  const authClient = await createServerSupabaseClient();
  const { data: { user }, error } = await authClient.auth.getUser();

  if (error || !user || !isPlatformAdmin(user.id)) {
    return { user: null, adminClient: null };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("The server-side Supabase service role environment variable is missing.");
  }

  const adminClient = createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { user, adminClient };
}

export async function GET() {
  try {
    const { adminClient } = await getAuthorizedAdmin();
    if (!adminClient) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const { data: owners, error } = await adminClient
      .from("business_memberships")
      .select("owner_id, created_at")
      .eq("role", "owner")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const uniqueOwners = Array.from(new Map((owners || []).map((row) => [row.owner_id, row])).values());
    const clients = await Promise.all(uniqueOwners.map(async (row) => {
      const { data } = await adminClient.auth.admin.getUserById(row.owner_id);
      return {
        owner_id: row.owner_id,
        email: data.user?.email || "Email unavailable",
        created_at: row.created_at,
      };
    }));

    return NextResponse.json({ clients });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load client accounts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { adminClient } = await getAuthorizedAdmin();
    if (!adminClient) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const body = await request.json();
    const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!businessName || businessName.length > 100) {
      return NextResponse.json({ error: "Enter a business name (maximum 100 characters)." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid owner email address." }, { status: 400 });
    }

    const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { business_name: businessName, account_type: "business_owner" },
      redirectTo: `${request.nextUrl.origin}/update-password`,
    });

    if (inviteError || !invitation.user) {
      return NextResponse.json({
        error: inviteError?.message || "Supabase did not return the invited user.",
      }, { status: 400 });
    }

    const ownerId = invitation.user.id;
    const { error: membershipError } = await adminClient
      .from("business_memberships")
      .upsert({
        owner_id: ownerId,
        user_id: ownerId,
        role: "owner",
        active: true,
      }, { onConflict: "owner_id,user_id" });

    if (membershipError) {
      await adminClient.auth.admin.deleteUser(ownerId);
      return NextResponse.json({ error: membershipError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}. The owner must accept the email and set a password.`,
      client: { owner_id: ownerId, email, business_name: businessName },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create the client account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
