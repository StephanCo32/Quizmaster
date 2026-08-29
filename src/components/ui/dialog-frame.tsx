"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

type DialogFrameProps = {
    title: string;
    children: ReactNode;
    onClose: () => void;
};

export function DialogFrame({ title, children, onClose }: DialogFrameProps) {
    return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog-frame" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header className="dialog-header"><h2 id="dialog-title">{title}</h2><button className="icon-button" type="button" title="Close dialog" aria-label="Close dialog" onClick={onClose}><X aria-hidden="true" /></button></header>{children}</section></div>;
}