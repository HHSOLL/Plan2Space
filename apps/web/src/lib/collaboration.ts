export type RealtimePatch = {
  id: string;
  payload: Record<string, unknown>;
};

export function applyRealtimePatch<T extends object>(state: T, patch: RealtimePatch): T {
  return { ...state, ...patch.payload } as T;
}
