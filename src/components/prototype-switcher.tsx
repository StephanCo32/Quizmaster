// PROTOTYPE — throwaway. Floating bottom-bar for flipping between ?variant= options while
// eyeballing a UI prototype. Hidden outside development. Delete alongside the variants it drives.
"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function PrototypeSwitcher({
  variants,
  paramName = "variant",
}: {
  variants: readonly { key: string; label: string }[];
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentKey = searchParams.get(paramName) ?? variants[0]?.key;
  const currentIndex = Math.max(0, variants.findIndex((variant) => variant.key === currentKey));

  function go(nextIndex: number) {
    const wrapped = (nextIndex + variants.length) % variants.length;
    const next = variants[wrapped];
    if (!next) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, next.key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "ArrowLeft") go(currentIndex - 1);
      if (event.key === "ArrowRight") go(currentIndex + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (process.env.NODE_ENV === "production") return null;

  const current = variants[currentIndex];

  return (
    <div className="proto-switcher" role="toolbar" aria-label="Prototype variant switcher">
      <button type="button" onClick={() => go(currentIndex - 1)} aria-label="Previous variant">
        ←
      </button>
      <span>{current ? `${current.key} — ${current.label}` : "no variant"}</span>
      <button type="button" onClick={() => go(currentIndex + 1)} aria-label="Next variant">
        →
      </button>
    </div>
  );
}
