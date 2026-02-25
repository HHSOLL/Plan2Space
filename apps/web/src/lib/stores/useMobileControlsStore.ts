import { create } from "zustand";

type Vector2 = { x: number; y: number };

type MobileControlsState = {
  move: Vector2;
  lookDelta: Vector2;
  setMove: (x: number, y: number) => void;
  addLookDelta: (dx: number, dy: number) => void;
  resetLookDelta: () => void;
};

export const useMobileControlsStore = create<MobileControlsState>((set) => ({
  move: { x: 0, y: 0 },
  lookDelta: { x: 0, y: 0 },
  setMove: (x, y) => set({ move: { x, y } }),
  addLookDelta: (dx, dy) =>
    set((state) => ({
      lookDelta: {
        x: state.lookDelta.x + dx,
        y: state.lookDelta.y + dy
      }
    })),
  resetLookDelta: () => set({ lookDelta: { x: 0, y: 0 } })
}));
