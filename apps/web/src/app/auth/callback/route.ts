import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function resolveNext(origin: string, nextParam: string | null) {
  const safeNext = nextParam && nextParam.startsWith("/") ? nextParam : "/studio";
  return new URL(safeNext, origin);
}

function withAuthStatus(url: URL, status: "success" | "error", message?: string) {
  const next = new URL(url.toString());
  next.searchParams.set("auth", status);
  if (message) next.searchParams.set("auth_message", message);
  return next;
}

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  request.cookies
    .getAll()
    .filter((cookie) => cookie.name.startsWith("sb-"))
    .forEach((cookie) => {
      response.cookies.set(cookie.name, "", {
        expires: new Date(0),
        maxAge: 0,
        path: "/"
      });
    });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const redirectUrl = resolveNext(url.origin, nextParam);
  const errorParam = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (errorParam) {
    const errorMessage = errorDescription ?? errorParam;
    const errorResponse = NextResponse.redirect(withAuthStatus(redirectUrl, "error", errorMessage));
    clearSupabaseCookies(request, errorResponse);
    return errorResponse;
  }

  if (!code) {
    return NextResponse.redirect(redirectUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const errorResponse = NextResponse.redirect(
      withAuthStatus(redirectUrl, "error", "Supabase 환경 변수가 설정되지 않았습니다.")
    );
    clearSupabaseCookies(request, errorResponse);
    return errorResponse;
  }

  const response = NextResponse.redirect(redirectUrl);
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const errorResponse = NextResponse.redirect(withAuthStatus(redirectUrl, "error", error.message));
    clearSupabaseCookies(request, errorResponse);
    return errorResponse;
  }

  const successUrl = withAuthStatus(redirectUrl, "success");
  response.headers.set("Location", successUrl.toString());
  return response;
}
