import { NextResponse } from "next/server";
import { z } from "zod";
import { getContentAdmin } from "@/lib/host/session";
import { createPictureCaptionTemplate, listPictureCaptionTemplates } from "@/lib/admin/templates";

const createSchema = z.object({ commandId: z.string().uuid(), name: z.string().trim().min(1).max(100), pictureUrl: z.string().url().refine((value) => value.startsWith("https://")), officialCaption: z.string().max(280).nullable().optional() });

export async function GET() {
    const admin = await getContentAdmin();
    if (!admin) return NextResponse.json({ error: "not_found" }, { status: 404 });
    try { return NextResponse.json({ templates: await listPictureCaptionTemplates(admin.id) }); } catch { return NextResponse.json({ error: "unavailable" }, { status: 503 }); }
}

export async function POST(request: Request) {
    const admin = await getContentAdmin();
    if (!admin) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    try { return NextResponse.json({ template: await createPictureCaptionTemplate({ adminId: admin.id, commandId: parsed.data.commandId, name: parsed.data.name, pictureUrl: parsed.data.pictureUrl, officialCaption: parsed.data.officialCaption ?? null }) }, { status: 201 }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "not_content_admin" ? "not_found" : "unavailable" }, { status: 503 }); }
}