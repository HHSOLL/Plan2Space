"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useMobileControlsStore } from "../../../lib/stores/useMobileControlsStore";

const JOYSTICK_RADIUS = 42;

export default function MobileControls() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const [isTouch, setIsTouch] = useState(false);
  const setMove = useMobileControlsStore((state) => state.setMove);
  const addLookDelta = useMobileControlsStore((state) => state.addLookDelta);

  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const movePointerId = useRef<number | null>(null);
  const moveOrigin = useRef({ x: 0, y: 0 });
  const lookPointerId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const supportsTouch = typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0);
    setIsTouch(Boolean(supportsTouch));
  }, []);

  useEffect(() => {
    if (viewMode !== "walk") {
      setMove(0, 0);
      setKnob({ x: 0, y: 0 });
    }
  }, [setMove, viewMode]);

  if (!isTouch || viewMode !== "walk") return null;

  return (
    <>
      <div className="pointer-events-none fixed bottom-10 left-10 z-40 h-28 w-28 rounded-full border border-white/15 bg-white/5" />
      <div
        className="fixed bottom-6 left-6 z-50 h-32 w-32 rounded-full"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          if (movePointerId.current !== null) return;
          movePointerId.current = event.pointerId;
          moveOrigin.current = { x: event.clientX, y: event.clientY };
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (movePointerId.current !== event.pointerId) return;
          const dx = event.clientX - moveOrigin.current.x;
          const dy = event.clientY - moveOrigin.current.y;
          const dist = Math.min(JOYSTICK_RADIUS, Math.hypot(dx, dy));
          const angle = Math.atan2(dy, dx);
          const nx = dist === 0 ? 0 : (dist / JOYSTICK_RADIUS) * Math.cos(angle);
          const ny = dist === 0 ? 0 : (dist / JOYSTICK_RADIUS) * Math.sin(angle);
          setMove(nx, ny);
          setKnob({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
        }}
        onPointerUp={(event) => {
          if (movePointerId.current !== event.pointerId) return;
          movePointerId.current = null;
          setMove(0, 0);
          setKnob({ x: 0, y: 0 });
          (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (movePointerId.current !== event.pointerId) return;
          movePointerId.current = null;
          setMove(0, 0);
          setKnob({ x: 0, y: 0 });
        }}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-md"
            style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
          />
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-6 right-6 z-40 h-32 w-32 rounded-full border border-white/10 bg-white/5" />
      <div
        className="fixed bottom-6 right-6 z-50 h-32 w-32 rounded-full"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          if (lookPointerId.current !== null) return;
          lookPointerId.current = event.pointerId;
          lookLast.current = { x: event.clientX, y: event.clientY };
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (lookPointerId.current !== event.pointerId) return;
          const dx = event.clientX - lookLast.current.x;
          const dy = event.clientY - lookLast.current.y;
          lookLast.current = { x: event.clientX, y: event.clientY };
          addLookDelta(dx, dy);
        }}
        onPointerUp={(event) => {
          if (lookPointerId.current !== event.pointerId) return;
          lookPointerId.current = null;
          (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (lookPointerId.current !== event.pointerId) return;
          lookPointerId.current = null;
        }}
      />
    </>
  );
}
