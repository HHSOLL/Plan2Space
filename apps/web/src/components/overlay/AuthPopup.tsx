"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId } from "react";
import { useAuthStore } from "../../lib/stores/useAuthStore";
import { toast } from "sonner";

interface AuthPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AuthPopup({ isOpen, onClose }: AuthPopupProps) {
    const { loginWithProvider, isLoading, error, notice, session } = useAuthStore();
    const isAuthenticated = Boolean(session?.user);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        if (!isOpen || !isAuthenticated) return;
        onClose();
    }, [isAuthenticated, isOpen, onClose]);

    useEffect(() => {
        if (error) toast.error(error);
    }, [error]);

    useEffect(() => {
        if (notice) toast.success(notice);
    }, [notice]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const buildRedirectUrl = () => {
        if (typeof window === "undefined") return undefined;
        const currentPath =
            `${window.location.pathname}${window.location.search}${window.location.hash}` || "/studio";
        return `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath)}`;
    };

    const handleSocialLogin = async (provider: "google" | "kakao") => {
        const redirectTo = buildRedirectUrl();
        await loginWithProvider(provider, redirectTo);
    };

    const GoogleIcon = () => (
        <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
            <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 12.35 17.74 9.5 24 9.5z"
            />
            <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 3.03-2.31 5.59-4.92 7.31l7.9 6.15c4.62-4.27 7.06-10.58 7.06-17.93z"
            />
            <path
                fill="#FBBC05"
                d="M10.54 28.4a14.5 14.5 0 0 1 0-8.81l-7.98-6.19A24 24 0 0 0 0 24c0 3.92.94 7.63 2.56 10.99l7.98-6.19z"
            />
            <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.9-6.15c-2.2 1.48-5.02 2.36-8 2.36-6.26 0-11.57-3.99-13.46-9.45l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
        </svg>
    );

    const KakaoIcon = () => (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="6" fill="#FEE500" />
            <path
                d="M9 7v10M9 12l6-5M9 12l6 5"
                stroke="#191919"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-white/40 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={descriptionId}
                        className="relative w-full max-w-md bg-white p-12 rounded-sm border border-[#e5e5e0] shadow-2xl"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            type="button"
                            aria-label="Close authentication dialog"
                            className="absolute top-10 right-10 p-3 rounded-full hover:bg-black/5 transition-colors z-10"
                        >
                            <X className="w-5 h-5 text-[#999999]" />
                        </button>

                        {/* Content */}
                        <div className="space-y-10">
                            <div className="space-y-4">
                                <h2 id={titleId} className="text-4xl font-cormorant font-light text-black">Access Studio</h2>
                                <p id={descriptionId} className="text-[10px] text-[#999999] font-bold uppercase tracking-widest leading-relaxed">
                                    Continue with Google or Kakao to enter the studio.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleSocialLogin("google")}
                                    className="w-full flex items-center justify-center gap-3 py-5 border border-[#1a1a1a] text-[#1a1a1a] font-bold text-[10px] uppercase tracking-[0.4em] hover:bg-[#1a1a1a] hover:text-white transition-all disabled:opacity-50"
                                >
                                    <GoogleIcon />
                                    Continue with Google
                                </button>
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleSocialLogin("kakao")}
                                    className="w-full flex items-center justify-center gap-3 py-5 bg-[#FEE500] text-[#191919] font-bold text-[10px] uppercase tracking-[0.4em] hover:bg-[#F7D200] transition-all disabled:opacity-50"
                                >
                                    <KakaoIcon />
                                    카카오로 계속하기
                                </button>
                            </div>

                            <div className="pt-4 text-center">
                                <button type="button" className="text-[9px] uppercase tracking-[0.3em] text-[#999999] hover:text-black transition-colors font-bold">
                                    Social login only (Google / Kakao)
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
