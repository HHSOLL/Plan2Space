"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "../../lib/stores/useAuthStore";

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
            },
        },
    }));
    const initialize = useAuthStore((state) => state.initialize);
    const router = useRouter();
    const lastAuthToastRef = useRef<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code && url.pathname !== "/auth/callback") {
            const callbackUrl = new URL("/auth/callback", window.location.origin);
            callbackUrl.searchParams.set("code", code);
            callbackUrl.searchParams.set("next", "/studio");
            const error = url.searchParams.get("error");
            if (error) callbackUrl.searchParams.set("error", error);
            const errorDescription = url.searchParams.get("error_description");
            if (errorDescription) callbackUrl.searchParams.set("error_description", errorDescription);
            window.location.replace(callbackUrl.toString());
            return;
        }
        initialize();
    }, [initialize]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const status = new URLSearchParams(window.location.search).get("auth");
        if (!status) {
            lastAuthToastRef.current = null;
            return;
        }
        if (lastAuthToastRef.current !== status) {
            if (status === "success") {
                toast.success("Welcome to Plan2Space Studio");
            } else if (status === "error") {
                toast.error("로그인에 실패했습니다.");
            }
            lastAuthToastRef.current = status;
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("auth");
        router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    }, [router]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
