import { create } from "zustand";

export type EditorViewMode = "2d-edit" | "top" | "walk";
export type TransformMode = "translate" | "rotate";

type EditorPanels = {
  properties: boolean;
  assets: boolean;
};

type EditorState = {
  viewMode: EditorViewMode;
  selectedId: string | null;
  panels: EditorPanels;
  transformMode: TransformMode;
  isTransforming: boolean;
  readOnly: boolean;
  setViewMode: (mode: EditorViewMode) => void;
  setSelectedId: (id: string | null) => void;
  openPanel: (panel: keyof EditorPanels) => void;
  closePanel: (panel: keyof EditorPanels) => void;
  togglePanel: (panel: keyof EditorPanels) => void;
  setTransformMode: (mode: TransformMode) => void;
  setIsTransforming: (value: boolean) => void;
  setReadOnly: (value: boolean) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  viewMode: "top",
  selectedId: null,
  panels: {
    properties: false,
    assets: false
  },
  transformMode: "translate",
  isTransforming: false,
  readOnly: false,
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedId: (id) => set({ selectedId: id }),
  openPanel: (panel) =>
    set((state) => ({ panels: { ...state.panels, [panel]: true } })),
  closePanel: (panel) =>
    set((state) => ({ panels: { ...state.panels, [panel]: false } })),
  togglePanel: (panel) =>
    set((state) => ({
      panels: { ...state.panels, [panel]: !state.panels[panel] }
    })),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setIsTransforming: (value) => set({ isTransforming: value }),
  setReadOnly: (value) => set({ readOnly: value })
}));
