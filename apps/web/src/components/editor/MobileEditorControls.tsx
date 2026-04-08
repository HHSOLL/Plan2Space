"use client";

type MobileEditorControlsProps = {
  visible: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToggleLibrary: () => void;
  onToggleInspector: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

export function MobileEditorControls({
  visible,
  canUndo,
  canRedo,
  onToggleLibrary,
  onToggleInspector,
  onUndo,
  onRedo
}: MobileEditorControlsProps) {
  if (!visible) return null;

  return (
    <div className="absolute left-3 right-3 top-3 z-[25] flex items-center justify-between gap-3 xl:hidden">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleLibrary}
          className="rounded-full border border-white/10 bg-black/45 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 backdrop-blur-xl"
        >
          Library
        </button>
        <button
          type="button"
          onClick={onToggleInspector}
          className="rounded-full border border-white/10 bg-black/45 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 backdrop-blur-xl"
        >
          Inspector
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80 backdrop-blur-xl disabled:opacity-30"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80 backdrop-blur-xl disabled:opacity-30"
        >
          Redo
        </button>
      </div>
    </div>
  );
}
