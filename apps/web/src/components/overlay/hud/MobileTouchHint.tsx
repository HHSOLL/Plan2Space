"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "../../../lib/stores/useEditorStore";

export default function MobileTouchHint() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const supportsTouch = typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0);
    setIsTouch(Boolean(supportsTouch));
  }, []);

  if (!isTouch || viewMode !== "walk") return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 z-40 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[9px] uppercase tracking-[0.3em] text-white/70">
      Touch controls beta
    </div>
  );
}
