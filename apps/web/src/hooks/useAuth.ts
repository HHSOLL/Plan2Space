"use client";

import { useAuthStore } from "../lib/stores/useAuthStore";

export function useAuth() {
  return useAuthStore();
}
