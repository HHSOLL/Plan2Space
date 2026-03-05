import type { NextFunction, Request, Response } from "express";
import { supabaseAnon } from "../services/supabase";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string | null;
        accessToken: string;
      };
    }
  }
}

function parseBearerToken(headerValue: string | undefined) {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = parseBearerToken(request.header("authorization"));
  if (!token) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    response.status(401).json({ error: error?.message ?? "Unauthorized" });
    return;
  }

  request.user = {
    id: data.user.id,
    email: data.user.email,
    accessToken: token
  };
  next();
}
