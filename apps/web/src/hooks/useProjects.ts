"use client";

import { useProjectStore } from "../lib/stores/useProjectStore";

export function useProjects() {
  return useProjectStore();
}
