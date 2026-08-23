"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { PictureCaptionTemplate } from "@/lib/supabase/database.types";

type TemplateForm = { name: string; pictureUrl: string; prompt: string };

export function TemplateCatalog({ initialTemplates }: { initialTemplates: PictureCaptionTemplate[] }) {
    const [templates, setTemplates] = useState(initialTemplates);
    const [editing, setEditing] = useState<PictureCaptionTemplate | null>(null);
    const [form, setForm] = useState<TemplateForm>({ name: "", pictureUrl: "", prompt: "" });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function resetForm() { setEditing(null); setForm({ name: "", pictureUrl: "", prompt: "" }); }
    function editTemplate(template: PictureCaptionTemplate) { setEditing(template); setForm({ name: template.name, pictureUrl: template.picture_url, prompt: template.prompt ?? "" }); setError(null); }

    async function submit(event: React.FormEvent) {
        event.preventDefault(); setBusy(true); setError(null);
        const response = await fetch(editing ? `/api/admin/templates/${editing.template_id}` : "/api/admin/templates", {
            method: editing ? "PUT" : "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...form, prompt: form.prompt || null, commandId: crypto.randomUUID(), ...(editing ? { expectedRevision: editing.revision } : {}) }),
        });
        if (!response.ok) { setError(response.status === 409 ? "This template changed elsewhere. Reload and try again." : "Template could not be saved."); setBusy(false); return; }
        const result = (await response.json()).template as PictureCaptionTemplate;
        setTemplates((current) => editing ? current.map((item) => item.template_id === result.template_id ? result : item) : [result, ...current]);
        resetForm(); setBusy(false);
    }

    async function removeTemplate(template: PictureCaptionTemplate) {
        setBusy(true); setError(null);
        const response = await fetch(`/api/admin/templates/${template.template_id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ commandId: crypto.randomUUID(), expectedRevision: template.revision }) });
        if (!response.ok) { setError(response.status === 409 ? "This template changed elsewhere. Reload and try again." : "Template could not be deleted."); setBusy(false); return; }
        setTemplates((current) => current.filter((item) => item.template_id !== template.template_id)); setBusy(false);
    }

    return (
        <main className="broadcast-shell">
            <header className="broadcast-header"><a className="broadcast-brand" href="/host"><span className="broadcast-mark">Q</span><span>Quizmaster</span></a><a className="broadcast-action" href="/host">Back to Parties</a></header>
            <div className="dashboard-grid"><section className="dashboard-stage"><p className="broadcast-kicker">Content desk</p><div className="dashboard-title-row"><div><h1>Picture-caption rounds</h1><p>Maintain the image and prompt library for new games.</p></div><button className="broadcast-action" type="button" onClick={() => { resetForm(); setError(null); }}><Plus aria-hidden="true" /> New template</button></div>
                {error && <div className="status-notice status-error" role="alert">{error}</div>}
                {templates.length === 0 ? <div className="empty-broadcast"><span>00</span><h2>No templates yet</h2><p>Add an HTTPS image and an optional caption prompt.</p></div> : <div className="party-list">{templates.map((template) => <div className="party-row" key={template.template_id}><Image src={`/api/pictures/${template.template_id}`} alt="" width={64} height={48} unoptimized /><div><strong>{template.name}</strong><span>{template.prompt || "No prompt"} · Revision {template.revision}</span></div><button className="icon-button" type="button" title={`Edit ${template.name}`} aria-label={`Edit ${template.name}`} onClick={() => editTemplate(template)}><Pencil aria-hidden="true" /></button><button className="icon-button" type="button" title={`Delete ${template.name}`} aria-label={`Delete ${template.name}`} onClick={() => removeTemplate(template)} disabled={busy}><Trash2 aria-hidden="true" /></button></div>)}</div>}
            </section>{(editing || form.name || form.pictureUrl) && <aside className="dashboard-rail"><span className="rail-label">{editing ? "Edit template" : "New template"}</span><form onSubmit={submit}><label>Name<input required minLength={1} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Picture URL<input required type="url" pattern="https://.*" value={form.pictureUrl} onChange={(event) => setForm({ ...form, pictureUrl: event.target.value })} /></label><label>Prompt<textarea maxLength={280} value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} /></label><button className="broadcast-action" disabled={busy} type="submit">{busy ? "Saving..." : editing ? "Save changes" : "Create template"}</button></form></aside>}</div>
+        </main>
    );
}
