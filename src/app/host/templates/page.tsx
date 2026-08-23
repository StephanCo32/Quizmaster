import type { Metadata } from "next";
import { TemplateCatalog } from "@/components/host/template-catalog";
import { listPictureCaptionTemplates } from "@/lib/admin/templates";
import { getContentAdmin } from "@/lib/host/session";

export const metadata: Metadata = { title: "Picture-caption templates" };

export default async function TemplatesPage() {
    const admin = await getContentAdmin();
    if (!admin) return <main className="broadcast-shell"><section className="dashboard-stage"><h1>Not found</h1><p>This Host account does not have content-admin access.</p></section></main>;
    return <TemplateCatalog initialTemplates={await listPictureCaptionTemplates(admin.id)} />;
}
