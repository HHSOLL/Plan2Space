"use client";

import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
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

    // Hydration handling for persistent store
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    const isEditor = pathname?.startsWith("/project/");

    if (isEditor) {
        return null;
    }

    const handleAction = (action: string) => {
        setIsMobileMenuOpen(false);
        if (!isAuthenticated && action !== 'about') {
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
            <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-md border-b border-[#e5e5e0] transition-all duration-500">
                <div className="max-w-[1440px] mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-12 py-4 sm:py-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => router.push("/")}
                    >
                        <span className="text-base sm:text-xl font-outfit font-medium tracking-[0.15em] sm:tracking-[0.2em] uppercase">Plan2Space</span>
                    </motion.div>

                    <div className="hidden md:flex items-center gap-12 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]">
                        {[
                            { name: 'Builder', action: 'builder' },
                            { name: 'Studio', action: 'studio' },
                            { name: 'Gallery', action: 'gallery' },
                            { name: 'Community', action: 'community' }
                        ].map((item) => (
                            <button
                                key={item.name}
                                onClick={() => handleAction(item.action)}
                                className={`hover:text-black transition-colors ${pathname === (item.action === 'studio' ? '/studio' : item.action === 'builder' ? '/studio/builder' : '/' + item.action) ? 'text-black' : ''}`}
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center gap-8">
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
                        ) : (
                            <button
                                onClick={() => (isAuthenticated ? router.push("/studio/builder") : setIsAuthOpen(true))}
                                className="px-6 py-2 border border-black text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-black hover:text-white transition-all"
                            >
                                Start Room
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                        className="md:hidden p-2 rounded-full border border-[#e5e5e0] bg-white/70"
                        aria-label="Toggle mobile menu"
                    >
                        {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    </button>
                </div>

                {isMobileMenuOpen && (
                    <div className="md:hidden border-t border-[#e5e5e0] bg-white/95 backdrop-blur-md px-4 py-4 space-y-4">
                        <div className="grid grid-cols-1 gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#666666]">
                            {[
                                { name: 'Builder', action: 'builder' },
                                { name: 'Studio', action: 'studio' },
                                { name: 'Gallery', action: 'gallery' },
                                { name: 'Community', action: 'community' }
                            ].map((item) => (
                                <button
                                    key={item.name}
                                    onClick={() => handleAction(item.action)}
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
                                    setIsAuthOpen(true);
                                }}
                                className="w-full px-6 py-2 border border-black text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-black hover:text-white transition-all"
                            >
                                Start Room
                            </button>
                        )}
                    </div>
                )}
            </nav>

            <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
        </>
    );
}
