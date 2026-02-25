import { create } from "zustand";

type InteractionState = {
  hint: string | null;
  setHint: (hint: string | null) => void;
};

export const useInteractionStore = create<InteractionState>((set) => ({
  hint: null,
  setHint: (hint) => set({ hint })
}));
