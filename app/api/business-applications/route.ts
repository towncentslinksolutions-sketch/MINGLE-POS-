import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Honeypot field: normal visitors should leave this empty.
    if (typeof body.website === "string" && body.website.trim()) {
      return NextResponse.json({ success: true, message: "Application received." }, { status: 201 });
    }

    const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const businessType = typeof body.businessType === "string" ? body.businessType.trim() : "";
    const location = typeof body.location === "string" ? body.location.trim() : "";

    if (!businessName || businessName.length > 100) return NextResponse.json({ error: "Enter a business name (maximum 100 characters)." }, { status: 400 });
    if (!ownerName || ownerName.length > 100) return NextResponse.json({ error: "Enter the owner's full name (maximum 100 characters)." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!phone || phone.length > 30) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    if (!businessType || businessType.length > 80) return NextResponse.json({ error: "Select a business type." }, { status: 400 });
    if (!location || location.length > 150) return NextResponse.json({ error: "Enter the business location." }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) throw new Error("Business application service is not configured.");

    const adminClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await adminClient.from("business_applications").insert({
      business_name: businessName,
      owner_name: ownerName,
      email,
      phone,
      business_type: businessType,
      location,
    });
    if (error) throw error;

    return NextResponse.json({ success: true, message: "Your application has been submitted for review. We will contact you after it has been reviewed." }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit your application." }, { status: 500 });
  }
}