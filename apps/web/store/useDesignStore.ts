import { create } from "zustand";
import type { Euler, FurnitureItem, Vec3 } from "../../../types/database";

type DesignStoreState = {
  furniture: FurnitureItem[];
  selectedItemId: string | null;

  addFurniture: (item: FurnitureItem) => void;
  updateFurnitureTransform: (id: string, pos: Vec3, rot: Euler, scale: Vec3) => void;
  selectItem: (id: string) => void;
  clearSelection: () => void;
};

export const useDesignStore = create<DesignStoreState>((set) => ({
  furniture: [],
  selectedItemId: null,

  addFurniture: (item) =>
    set((state) => ({
      furniture: [...state.furniture, item]
    })),

  updateFurnitureTransform: (id, pos, rot, scale) =>
    set((state) => ({
      furniture: state.furniture.map((item) => (item.id === id ? { ...item, position: pos, rotation: rot, scale } : item))
    })),

  selectItem: (id) => set({ selectedItemId: id }),
  clearSelection: () => set({ selectedItemId: null })
}));

