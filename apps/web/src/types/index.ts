import type { AuthUser } from "./auth";

export interface AuthLoginResponse {
  user: AuthUser;
  token: string;
  refreshToken: string;
}

export interface AuthSignupResponse {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  message?: string;
}

export interface AuthErrorResponse {
  error: string;
}

export type { AuthUser } from "./auth";
export type { Furniture } from "./furniture";
