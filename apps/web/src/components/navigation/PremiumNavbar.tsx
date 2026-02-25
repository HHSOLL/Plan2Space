"use client";

import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuthStore } from "../../lib/stores/useAuthStore";
import { useLanguageStore } from "../../lib/stores/useLanguageStore";
import { AuthPopup } from "../overlay/AuthPopup";
import { NewProjectModal } from "../overlay/NewProjectModal";

export function PremiumNavbar() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, session, logout } = useAuthStore();
    const { language, setLanguage } = useLanguageStore();
    const isAuthenticated = Boolean(session?.user);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

    // Hydration handling for persistent store
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const isEditor = pathname?.startsWith("/project/");

    if (isEditor) {
        return null;
    }

    const handleAction = (action: string) => {
        if (!isAuthenticated && action !== 'about') {
            setIsAuthOpen(true);
            return;
        }

        switch (action) {
            case 'studio':
                router.push("/studio");
                break;
            case 'gallery':
                router.push("/gallery");
                break;
            case 'community':
                router.push("/community");
                break;
            case 'new':
                setIsProjectModalOpen(true);
                break;
        }
    };

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-md border-b border-[#e5e5e0] transition-all duration-500">
                <div className="max-w-[1440px] mx-auto flex items-center justify-between px-12 py-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => router.push("/")}
                    >
                        <span className="text-xl font-outfit font-medium tracking-[0.2em] uppercase">Plan2Space</span>
                    </motion.div>

                    <div className="hidden md:flex items-center gap-12 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]">
                        {[
                            { name: 'Studio', action: 'studio' },
                            { name: 'Gallery', action: 'gallery' },
                            { name: 'Community', action: 'community' }
                        ].map((item) => (
                            <button
                                key={item.name}
                                onClick={() => handleAction(item.action)}
                                className={`hover:text-black transition-colors ${pathname === (item.action === 'studio' ? '/studio' : '/' + item.action) ? 'text-black' : ''}`}
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-8">
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
                                onClick={() => setIsAuthOpen(true)}
                                className="px-6 py-2 border border-black text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-black hover:text-white transition-all"
                            >
                                Get Started
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
            <NewProjectModal
                isOpen={isProjectModalOpen}
                onClose={() => setIsProjectModalOpen(false)}
            />
        </>
    );
}
