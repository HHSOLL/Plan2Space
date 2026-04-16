"use client";

import { motion } from "framer-motion";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const isSharedViewer = pathname?.startsWith("/shared/");
  const isStartFlow = pathname?.startsWith("/studio/select") || pathname?.startsWith("/studio/builder");
  const isHome = pathname === "/";
  const isSimpleMode = isHome || isStartFlow;

  if (isEditor || isSharedViewer) {
    return null;
  }

  const openAuth = (nextPath: string) => {
    setAuthNextPath(nextPath);
    setIsAuthOpen(true);
  };

  const handleAction = (action: "builder" | "projects" | "gallery" | "community") => {
    setIsMobileMenuOpen(false);

    if (!isAuthenticated && (action === "builder" || action === "projects")) {
      openAuth(action === "builder" ? "/studio/builder?intent=custom" : "/studio");
      return;
    }

    if (action === "builder") {
      router.push("/studio/builder?intent=custom");
      return;
    }
    if (action === "projects") {
      router.push("/studio");
      return;
    }
    if (action === "gallery") {
      router.push("/gallery");
      return;
    }
    router.push("/community");
  };

  if (isSimpleMode) {
    return (
      <>
        <nav className="fixed left-0 right-0 top-0 z-[100] border-b border-[#ece8e2] bg-white/92 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1820px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => router.push("/")}
              className="text-left text-[20px] font-semibold tracking-[-0.04em] text-[#181818]"
            >
              Plan2Space
            </motion.button>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-[#6e665d] sm:block">
                  {user?.name ?? user?.email ?? "내 공간"}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-[#1f1f1f] px-5 text-sm font-semibold text-[#1a1a1a] transition hover:bg-[#111111] hover:text-white"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuth(pathname ?? "/")}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#111111] px-5 text-sm font-semibold text-white transition hover:bg-black"
              >
                로그인
              </button>
            )}
          </div>
        </nav>

        <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={authNextPath} />
      </>
    );
  }

  return (
    <>
      <nav className="fixed left-0 right-0 top-0 z-[100] border-b border-[#e5e5e0] bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-6 lg:px-12">
          <div className="flex items-center justify-between">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => router.push("/")}
              className="font-outfit text-base font-medium uppercase tracking-[0.15em] text-[#241c14] sm:text-xl sm:tracking-[0.2em]"
            >
              Plan2Space
            </motion.button>

            <div className="hidden items-center gap-12 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666] md:flex">
              {[
                { name: "홈", href: "/" },
                { name: "방 만들기", action: "builder" as const },
                { name: "내 공간", action: "projects" as const },
                { name: "갤러리", action: "gallery" as const },
                { name: "커뮤니티", action: "community" as const }
              ].map((item) => {
                const isActive = "href" in item ? pathname === item.href : false;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => ("href" in item ? router.push(item.href) : handleAction(item.action))}
                    className={`transition-colors hover:text-black ${isActive ? "text-black" : ""}`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>

            <div className="hidden items-center gap-4 md:flex">
              {isAuthenticated ? (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#999999]">
                    {user?.name ?? user?.email ?? "내 프로젝트"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-[11px] font-semibold text-[#181818] transition hover:border-black/30"
                  >
                    <LogOut className="h-4 w-4" />
                    로그아웃
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuth("/studio/builder?intent=custom")}
                  className="rounded-full border border-black px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-black hover:text-white"
                >
                  로그인
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="rounded-full border border-[#e5e5e0] bg-white/70 p-2 md:hidden"
              aria-label="모바일 메뉴 열기/닫기"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen ? (
          <div className="mx-auto max-w-[1440px] border-t border-[#e5e5e0] bg-white/95 px-4 py-4 backdrop-blur-md md:hidden">
            <div className="grid grid-cols-1 gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#666666]">
              {[
                { name: "홈", href: "/" },
                { name: "방 만들기", action: "builder" as const },
                { name: "내 공간", action: "projects" as const },
                { name: "갤러리", action: "gallery" as const },
                { name: "커뮤니티", action: "community" as const }
              ].map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => ("href" in item ? router.push(item.href) : handleAction(item.action))}
                  className="w-full rounded-full border border-[#e5e5e0] px-4 py-2 text-left transition-colors hover:border-black hover:text-black"
                >
                  {item.name}
                </button>
              ))}
            </div>

            {isAuthenticated ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[#777777]">
                  {user?.name ?? user?.email ?? "내 프로젝트"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    void logout();
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-[11px] font-semibold text-[#181818]"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  openAuth("/studio/builder?intent=custom");
                }}
                className="mt-3 w-full rounded-full border border-black px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-black hover:text-white"
              >
                로그인
              </button>
            )}
          </div>
        ) : null}
      </nav>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={authNextPath} />
    </>
  );
}
