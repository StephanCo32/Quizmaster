import { NextResponse } from "next/server";
import { z } from "zod";
import { getContentAdmin } from "@/lib/host/session";
import { grantContentAdmin, revokeContentAdmin } from "@/lib/admin/templates";

const userIdSchema = z.string().uuid();

export async function PUT(_request: Request, context: { params: Promise<{ userId: string }> }) {
    const admin = await getContentAdmin();
    const { userId } = await context.params;
    if (!admin || !userIdSchema.safeParse(userId).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    try { await grantContentAdmin(admin.id, userId); return NextResponse.json({ granted: true }); }
    catch { return NextResponse.json({ error: "unavailable" }, { status: 503 }); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ userId: string }> }) {
    const admin = await getContentAdmin();
    const { userId } = await context.params;
    if (!admin || !userIdSchema.safeParse(userId).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    try { await revokeContentAdmin(admin.id, userId); return NextResponse.json({ revoked: true }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "final_content_admin" ? "final_content_admin" : "unavailable" }, { status: error instanceof Error && error.message === "final_content_admin" ? 409 : 503 }); }
}