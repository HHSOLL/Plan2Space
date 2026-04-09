"use client";

import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { Heart, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuthStore } from "../../lib/stores/useAuthStore";
import { useLanguageStore } from "../../lib/stores/useLanguageStore";
import { AuthPopup } from "../overlay/AuthPopup";

export function PremiumNavbar() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, session, logout } = useAuthStore();
    const { language, setLanguage } = useLanguageStore();
    const isAuthenticated = Boolean(session?.user);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [authNextPath, setAuthNextPath] = useState<string | undefined>(undefined);

    // Hydration handling for persistent store
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    const isEditor = pathname?.startsWith("/project/");
    const isHome = pathname === "/";

    if (isEditor) {
        return null;
    }

    const handleAction = (action: string) => {
        setIsMobileMenuOpen(false);
        const requiresAuth = action === 'builder' || action === 'studio';
        if (!isAuthenticated && requiresAuth) {
            setAuthNextPath(action === 'builder' ? "/studio/builder" : "/studio");
            setIsAuthOpen(true);
            return;
        }

        switch (action) {
            case 'builder':
                router.push("/studio/builder");
                break;
            case 'studio':
                router.push("/studio");
                break;
            case 'gallery':
                router.push("/gallery");
                break;
            case 'community':
                router.push("/community");
                break;
        }
    };

    return (
        <>
            <nav className={`fixed left-0 right-0 z-[100] transition-all duration-500 ${isHome ? 'top-4 sm:top-5' : 'top-0 border-b border-[#e5e5e0] bg-white/80 backdrop-blur-md'}`}>
                <div className={`mx-auto ${isHome ? 'max-w-[1440px] px-4 sm:px-6 lg:px-10' : 'max-w-[1440px] px-4 sm:px-6 lg:px-12 py-4 sm:py-6'}`}>
                    <div className={`flex items-center justify-between ${isHome ? 'rounded-full border border-white/70 bg-white/92 px-5 py-4 shadow-[0_18px_45px_rgba(48,34,17,0.14)] backdrop-blur-xl sm:px-7' : ''}`}>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => router.push("/")}
                    >
                        <span className={`font-outfit font-medium uppercase ${isHome ? 'text-sm sm:text-base tracking-[0.28em] text-[#241c14]' : 'text-base sm:text-xl tracking-[0.15em] sm:tracking-[0.2em]'}`}>Plan2Space</span>
                    </motion.div>

                    <div className={`hidden md:flex items-center ${isHome ? 'gap-8 text-[10px] font-semibold tracking-[0.18em] text-[#6e6255]' : 'gap-12 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]'}`}>
                        {[
                            { name: 'Home', action: 'home' },
                            { name: 'Builder', action: 'builder' },
                            { name: 'Studio', action: 'studio' },
                            { name: 'Gallery', action: 'gallery' },
                            { name: 'Community', action: 'community' }
                        ].map((item) => (
                            <button
                                key={item.name}
                                onClick={() => item.action === 'home' ? router.push("/") : handleAction(item.action)}
                                className={`transition-colors hover:text-black ${pathname === (item.action === 'home' ? '/' : item.action === 'studio' ? '/studio' : item.action === 'builder' ? '/studio/builder' : '/' + item.action) ? 'text-black' : ''}`}
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>

                    <div className={`hidden md:flex items-center ${isHome ? 'gap-4' : 'gap-8'}`}>
                        {isHome && (
                            <>
                                <button
                                    type="button"
                                    aria-label="Open gallery"
                                    onClick={() => router.push("/gallery")}
                                    className="rounded-full border border-[#e7ddd0] p-2.5 text-[#47392a] transition-colors hover:bg-[#f3ece2]"
                                >
                                    <Search className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Open community"
                                    onClick={() => router.push("/community")}
                                    className="rounded-full border border-[#e7ddd0] p-2.5 text-[#47392a] transition-colors hover:bg-[#f3ece2]"
                                >
                                    <Heart className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    aria-label={isAuthenticated ? "Open studio" : "Sign in"}
                                    onClick={() => {
                                        if (isAuthenticated) {
                                            router.push("/studio");
                                            return;
                                        }
                                        setAuthNextPath("/studio");
                                        setIsAuthOpen(true);
                                    }}
                                    className="rounded-full border border-[#e7ddd0] p-2.5 text-[#47392a] transition-colors hover:bg-[#f3ece2]"
                                >
                                    <UserRound className="h-4 w-4" />
                                </button>
                            </>
                        )}
                        {/* Language Toggle */}
                        {mounted && (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setLanguage('en')}
                                    className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${language === 'en' ? 'text-black' : 'text-[#bbbbbb] hover:text-black'
                                        }`}
                                >
                                    EN
                                </button>
                                <div className="w-[1px] h-2 bg-[#e5e5e0]" />
                                <button
                                    onClick={() => setLanguage('ko')}
                                    className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${language === 'ko' ? 'text-black' : 'text-[#bbbbbb] hover:text-black'
                                        }`}
                                >
                                    KR
                                </button>
                            </div>
                        )}

                        {isAuthenticated ? (
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#999999]">
                                    {user?.name ?? user?.email ?? "Studio"}
                                </span>
                                <button onClick={() => void logout()} className="p-2 hover:bg-black/5 rounded-full transition-colors group">
                                    <LogOut className="w-4 h-4 text-black/20 group-hover:text-red-400" />
                                </button>
                            </div>
                        ) : !isHome ? (
                            <button
                                onClick={() => {
                                    setAuthNextPath("/studio/builder");
                                    setIsAuthOpen(true);
                                }}
                                className="px-6 py-2 border border-black text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-black hover:text-white transition-all"
                            >
                                Start Room
                            </button>
                        ) : null}
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                        className={`md:hidden p-2 rounded-full border ${isHome ? 'border-[#e7ddd0] bg-white' : 'border-[#e5e5e0] bg-white/70'}`}
                        aria-label="Toggle mobile menu"
                    >
                        {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    </button>
                    </div>
                </div>

                {isMobileMenuOpen && (
                    <div className={`mx-auto mt-3 md:hidden max-w-[1440px] space-y-4 px-4 ${isHome ? '' : 'border-t border-[#e5e5e0] bg-white/95 py-4 backdrop-blur-md'}`}>
                        <div className={isHome ? 'rounded-[28px] border border-[#e5dbcf] bg-white/95 p-4 shadow-[0_18px_40px_rgba(49,34,16,0.12)] backdrop-blur-md' : ''}>
                        <div className="grid grid-cols-1 gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#666666]">
                            {[
                                { name: 'Home', action: 'home' },
                                { name: 'Builder', action: 'builder' },
                                { name: 'Studio', action: 'studio' },
                                { name: 'Gallery', action: 'gallery' },
                                { name: 'Community', action: 'community' }
                            ].map((item) => (
                                <button
                                    key={item.name}
                                    onClick={() => item.action === 'home' ? router.push("/") : handleAction(item.action)}
                                    className="w-full rounded-full border border-[#e5e5e0] px-4 py-2 text-left hover:text-black hover:border-black transition-colors"
                                >
                                    {item.name}
                                </button>
                            ))}
                        </div>

                        {mounted && (
                            <div className="flex items-center gap-3 pt-1">
                                <button
                                    onClick={() => setLanguage('en')}
                                    className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${language === 'en' ? 'text-black' : 'text-[#bbbbbb] hover:text-black'
                                        }`}
                                >
                                    EN
                                </button>
                                <div className="w-[1px] h-2 bg-[#e5e5e0]" />
                                <button
                                    onClick={() => setLanguage('ko')}
                                    className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${language === 'ko' ? 'text-black' : 'text-[#bbbbbb] hover:text-black'
                                        }`}
                                >
                                    KR
                                </button>
                            </div>
                        )}

                        {isAuthenticated ? (
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#777777] truncate">
                                    {user?.name ?? user?.email ?? "Studio"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        void logout();
                                    }}
                                    className="p-2 hover:bg-black/5 rounded-full transition-colors group"
                                >
                                    <LogOut className="w-4 h-4 text-black/30 group-hover:text-red-400" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    setAuthNextPath("/studio/builder");
                                    setIsAuthOpen(true);
                                }}
                                className="w-full px-6 py-2 border border-black text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-black hover:text-white transition-all"
                            >
                                Start Room
                            </button>
                        )}
                        </div>
                    </div>
                )}
            </nav>

            <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={authNextPath} />
        </>
    );
}
