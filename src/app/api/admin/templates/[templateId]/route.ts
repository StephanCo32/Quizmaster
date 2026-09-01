import { NextResponse } from "next/server";
import { z } from "zod";
import { getContentAdmin } from "@/lib/host/session";
import { deletePictureCaptionTemplate, updatePictureCaptionTemplate } from "@/lib/admin/templates";

const updateSchema = z.object({ commandId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), name: z.string().trim().min(1).max(100), pictureUrl: z.string().url().refine((value) => value.startsWith("https://")), officialCaption: z.string().max(280).nullable().optional() });
const deleteSchema = z.object({ commandId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() });

export async function PUT(request: Request, context: { params: Promise<{ templateId: string }> }) {
    const admin = await getContentAdmin();
    if (!admin) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const { templateId } = await context.params;
    try { return NextResponse.json({ template: await updatePictureCaptionTemplate({ adminId: admin.id, templateId, ...parsed.data, officialCaption: parsed.data.officialCaption ?? null }) }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "stale_revision" ? "stale_revision" : "unavailable" }, { status: error instanceof Error && error.message === "stale_revision" ? 409 : 503 }); }
}

export async function DELETE(request: Request, context: { params: Promise<{ templateId: string }> }) {
    const admin = await getContentAdmin();
    if (!admin) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const { templateId } = await context.params;
    try { return NextResponse.json({ deleted: await deletePictureCaptionTemplate({ adminId: admin.id, templateId, ...parsed.data }) }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "stale_revision" ? "stale_revision" : "unavailable" }, { status: error instanceof Error && error.message === "stale_revision" ? 409 : 503 }); }
}