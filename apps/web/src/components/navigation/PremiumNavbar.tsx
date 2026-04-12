"use client";

import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuthStore } from "../../lib/stores/useAuthStore";
import { AuthPopup } from "../overlay/AuthPopup";

export function PremiumNavbar() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, session, logout } = useAuthStore();
    const isAuthenticated = Boolean(session?.user);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [authNextPath, setAuthNextPath] = useState<string | undefined>(undefined);

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
        const requiresAuth = action === 'builder' || action === 'projects';
        if (!isAuthenticated && requiresAuth) {
            setAuthNextPath(action === 'builder' ? "/studio/builder" : "/studio");
            setIsAuthOpen(true);
            return;
        }

        switch (action) {
            case 'builder':
                router.push("/studio/builder");
                break;
            case 'projects':
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
                            { name: '홈', action: 'home' },
                            { name: '방 만들기', action: 'builder' },
                            { name: '내 공간', action: 'projects' },
                            { name: '갤러리', action: 'gallery' },
                            { name: '커뮤니티', action: 'community' }
                        ].map((item) => (
                            <button
                                key={item.name}
                                onClick={() => item.action === 'home' ? router.push("/") : handleAction(item.action)}
                                className={`transition-colors hover:text-black ${pathname === (item.action === 'home' ? '/' : item.action === 'projects' ? '/studio' : item.action === 'builder' ? '/studio/builder' : '/' + item.action) ? 'text-black' : ''}`}
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
                                    aria-label="갤러리 열기"
                                    onClick={() => router.push("/gallery")}
                                    className="rounded-full border border-[#e7ddd0] p-2.5 text-[#47392a] transition-colors hover:bg-[#f3ece2]"
                                >
                                    <Search className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    aria-label={isAuthenticated ? "내 공간 열기" : "로그인"}
                                    onClick={() => {
                                        if (isAuthenticated) {
                                            router.push("/studio");
                                            return;
                                        }
                                        setAuthNextPath(pathname ?? "/");
                                        setIsAuthOpen(true);
                                    }}
                                    className="rounded-full border border-[#e7ddd0] p-2.5 text-[#47392a] transition-colors hover:bg-[#f3ece2]"
                                >
                                    <UserRound className="h-4 w-4" />
                                </button>
                            </>
                        )}
                        {isAuthenticated ? (
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#999999]">
                                    {user?.name ?? user?.email ?? "내 프로젝트"}
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
                                방 만들기
                            </button>
                        ) : null}
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                        className={`md:hidden p-2 rounded-full border ${isHome ? 'border-[#e7ddd0] bg-white' : 'border-[#e5e5e0] bg-white/70'}`}
                        aria-label="모바일 메뉴 열기/닫기"
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
                                { name: '홈', action: 'home' },
                                { name: '방 만들기', action: 'builder' },
                                { name: '내 공간', action: 'projects' },
                                { name: '갤러리', action: 'gallery' },
                                { name: '커뮤니티', action: 'community' }
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

                        {isAuthenticated ? (
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#777777] truncate">
                                    {user?.name ?? user?.email ?? "내 프로젝트"}
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
                                방 만들기
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
