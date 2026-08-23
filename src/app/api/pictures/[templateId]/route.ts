import { NextResponse } from "next/server";
import { getPictureCaptionTemplateSource } from "@/lib/admin/templates";

const unavailable = () => new NextResponse(null, { status: 404 });

export async function GET(_request: Request, context: { params: Promise<{ templateId: string }> }) {
    const { templateId } = await context.params;
    try {
        const source = await getPictureCaptionTemplateSource(templateId);
        if (!source) return unavailable();
        const response = await fetch(source.picture_url, { redirect: "follow" });
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) return unavailable();
        return new NextResponse(response.body, { headers: { "Content-Type": response.headers.get("content-type") ?? "image/*" } });
    } catch { return unavailable(); }
}