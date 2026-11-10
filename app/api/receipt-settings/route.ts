import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Please sign in to view receipt details." }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error("Server-side Supabase service role key is not configured.");

    const admin = createSupabaseClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: membership, error: membershipError } = await admin
      .from("business_memberships")
      .select("owner_id, active")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
      return NextResponse.json({ error: "Your business membership is inactive." }, { status: 403 });
    }

    const { data, error } = await admin
      .from("business_settings")
      .select("business_name, logo_url, business_phone, business_email, business_address, support_phone, support_email, receipt_footer, return_policy, currency")
      .eq("owner_id", membership.owner_id)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ settings: data || null });
  } catch (error) {
    console.error("[receipt-settings] GET failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to load receipt settings."
    }, { status: 500 });
  }
}
