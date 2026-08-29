"use client";

import { DialogFrame } from "@/components/ui/dialog-frame";

type ConfirmDialogProps = {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onClose: () => void;
};

export function ConfirmDialog({ title, message, confirmLabel = "Yes", onConfirm, onClose }: ConfirmDialogProps) {
    return <DialogFrame title={title} onClose={onClose}><p className="dialog-message">{message}</p><div className="dialog-actions"><button className="back-link" type="button" onClick={onClose}>Cancel</button><button className="broadcast-action" type="button" onClick={onConfirm}>{confirmLabel}</button></div></DialogFrame>;
}