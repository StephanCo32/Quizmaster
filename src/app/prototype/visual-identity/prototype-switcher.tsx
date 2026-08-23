"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const variants = ["A", "B", "C"] as const;
const roles = ["host", "player", "display"] as const;

const variantNames = {
    A: "Playful board",
    B: "Paper party",
    C: "Broadcast blocks",
};

type PrototypeSwitcherProps = {
    currentRole: (typeof roles)[number];
    currentVariant: (typeof variants)[number];
};

export function PrototypeSwitcher({ currentRole, currentVariant }: PrototypeSwitcherProps) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    function update(next: { role?: string; variant?: string }) {
        const params = new URLSearchParams(searchParams.toString());
        if (next.role) params.set("role", next.role);
        if (next.variant) params.set("variant", next.variant);
        router.replace(`${pathname}?${params.toString()}`);
    }

    function cycle(direction: -1 | 1) {
        const index = variants.indexOf(currentVariant);
        update({ variant: variants[(index + direction + variants.length) % variants.length] });
    }

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            const target = event.target as HTMLElement;
            if (target.matches("input, textarea, [contenteditable='true']")) return;
            if (event.key === "ArrowLeft") cycle(-1);
            if (event.key === "ArrowRight") cycle(1);
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    });

    if (process.env.NODE_ENV === "production") return null;

    return (
        <aside className="prototype-switcher" aria-label="Prototype controls">
            <div className="prototype-roles" aria-label="Preview role">
                {roles.map((role) => (
                    <button
                        aria-pressed={role === currentRole}
                        key={role}
                        onClick={() => update({ role })}
                        type="button"
                    >
                        {role}
                    </button>
                ))}
            </div>
            <button aria-label="Previous visual variant" onClick={() => cycle(-1)} type="button">←</button>
            <strong>{currentVariant} · {variantNames[currentVariant]}</strong>
            <button aria-label="Next visual variant" onClick={() => cycle(1)} type="button">→</button>
        </aside>
    );
}