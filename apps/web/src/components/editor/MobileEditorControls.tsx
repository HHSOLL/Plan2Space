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
    <div className="absolute left-3 right-3 top-3 z-[25] flex items-center justify-between gap-2 overflow-x-auto xl:hidden">
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white/92 p-1 shadow-[0_12px_28px_rgba(19,21,24,0.16)] backdrop-blur-xl">
        <button
          type="button"
          onClick={onToggleLibrary}
          className="rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#3d352b] transition hover:bg-[#f2eee7]"
        >
          목록
        </button>
        <button
          type="button"
          onClick={onToggleInspector}
          className="rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#3d352b] transition hover:bg-[#f2eee7]"
        >
          속성
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white/92 p-1 shadow-[0_12px_28px_rgba(19,21,24,0.16)] backdrop-blur-xl">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#3d352b] transition hover:bg-[#f2eee7] disabled:opacity-30"
        >
          실행 취소
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#3d352b] transition hover:bg-[#f2eee7] disabled:opacity-30"
        >
          다시 실행
        </button>
      </div>
    </div>
  );
}
