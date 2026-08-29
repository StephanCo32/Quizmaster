import { NextResponse } from "next/server";
import { getContentAdmin } from "@/lib/host/session";
import { listContentAdminIds } from "@/lib/admin/templates";

export async function GET() {
    const admin = await getContentAdmin();
    if (!admin) return NextResponse.json({ error: "not_found" }, { status: 404 });
    try { return NextResponse.json({ administrators: await listContentAdminIds(admin.id) }); }
    catch { return NextResponse.json({ error: "unavailable" }, { status: 503 }); }
}