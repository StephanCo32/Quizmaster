import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/host/admin-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    const response = NextResponse.redirect(new URL("/host", request.url), { status: 303 });
    clearAdminSession(response);
    return response;
}