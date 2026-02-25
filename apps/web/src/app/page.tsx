"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, Play } from "lucide-react";
import { useState, useEffect } from "react";
import { AuthPopup } from "../components/overlay/AuthPopup";
import { NewProjectModal } from "../components/overlay/NewProjectModal";
import { useAuthStore } from "../lib/stores/useAuthStore";
import { useLanguageStore } from "../lib/stores/useLanguageStore";
import { translations } from "../lib/i18n/translations";

export default function HomePage() {
  const router = useRouter();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const { session } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const isAuthenticated = Boolean(session?.user);
  const reduceMotion = useReducedMotion();

  // Hydration handling for persistent store
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const t = translations[language];

  const handleAction = (id: string) => {
    if ((id === 'new' || id === 'dashboard') && !isAuthenticated) {
      setIsAuthOpen(true);
      return;
    }

    switch (id) {
      case 'new':
        setIsProjectModalOpen(true);
        break;
      case 'dashboard':
        router.push("/studio");
        break;
      case 'gallery':
        router.push("/gallery");
        break;
      case 'community':
        router.push("/community");
        break;
      case 'login':
        setIsAuthOpen(true);
        break;
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen bg-[#fdfdfc] text-[#1a1a1a] selection:bg-black/5 font-sans overflow-x-hidden">
      <main className="max-w-[1440px] mx-auto px-12">
        {/* Refined Header */}
        <section className="pt-24 pb-16">
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
              className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-[0.3em] text-[#999999] mb-8"
            >
              <span>{t.hero.subtitle_1}</span>
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              <span>{t.hero.subtitle_2}</span>
            </motion.div>

            <h1 className="text-8xl font-cormorant font-light tracking-tight leading-[1.1] mb-12 whitespace-pre-wrap">
              {t.hero.title}
            </h1>

            <div className="flex gap-4">
              <button
                onClick={() => handleAction('new')}
                className="flex items-center gap-3 px-10 py-5 bg-black text-white text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-stone-800 transition-all"
              >
                {t.hero.cta_new} <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push('/gallery')}
                className="flex items-center gap-3 px-10 py-5 border border-black text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-black hover:text-white transition-all"
              >
                {t.hero.cta_gallery}
              </button>
            </div>
          </div>
        </section>

        {/* Hero Image Section */}
        <section className="py-12">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 1.5, ease: "easeOut" }}
            className="relative aspect-video rounded-sm overflow-hidden bg-[#f3f3f1] border border-[#e5e5e0] shadow-sm"
          >
            <img
              src="/assets/landing/hero.png"
              alt="Elite Architectural Design"
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover object-bottom transition-all duration-1000"
            />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
          </motion.div>
        </section>

        {/* House Layout & Data Section (AI Analysis) */}
        <section className="py-32 grid grid-cols-1 md:grid-cols-2 gap-24 items-center">
          <div className="space-y-12">
            <div className="flex gap-4 border-b border-[#e5e5e0] pb-4">
              <button className="bg-[#1a1a1a] text-white px-6 py-2 text-[10px] font-bold uppercase tracking-widest">{t.analysis.tag_1}</button>
              <button className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-[#999999] hover:text-black transition-colors border-transparent">{t.analysis.tag_2}</button>
            </div>
            <div className="aspect-[4/3] bg-[#f9f9f7] border border-[#e5e5e0] flex items-center justify-center overflow-hidden">
              <img
                src="/assets/landing/analysis.png"
                alt="Blueprint Analysis"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-16">
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-600">{t.analysis.section_tag}</span>
              <h2 className="text-5xl font-cormorant font-light leading-tight">{t.analysis.title}</h2>
            </div>
            <p className="text-sm leading-relaxed text-[#666666] max-w-md">
              {t.analysis.description}
            </p>
            <div className="space-y-6">
              {[
                t.analysis.features.recognition,
                t.analysis.features.texturing,
                t.analysis.features.physics,
                t.analysis.features.cloud,
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-4 border-b border-[#e5e5e0] text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-[#999999]">{item.label}</span>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Atmosphere Section */}
        <section className="py-24 border-t border-[#e5e5e0]">
          <div className="flex items-end justify-between mb-16">
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#999999]">{t.atmosphere.tag}</span>
              <h2 className="text-5xl font-cormorant font-light max-w-md leading-tight">
                {t.atmosphere.title}
              </h2>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/assets')}
                className="flex items-center gap-3 px-8 py-4 border border-[#e5e5e0] hover:bg-[#1a1a1a] hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest"
              >
                {t.atmosphere.cta} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-2 aspect-[21/10] overflow-hidden border border-[#e5e5e0]">
              <img
                src="/assets/landing/hero.png"
                alt="Interior View"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="aspect-square md:aspect-auto overflow-hidden border border-[#e5e5e0]">
              <img
                src="/assets/landing/detail.png"
                alt="Furniture Detail"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Demo Video Section */}
        <section className="py-32 border-t border-[#e5e5e0]">
          <div className="text-center mb-16 space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#999999]">{t.demo.tag}</span>
            <h2 className="text-4xl font-cormorant font-light underline underline-offset-[12px] decoration-[#e5e5e0]">{t.demo.title}</h2>
          </div>

          <div className="relative aspect-video rounded-sm overflow-hidden group border border-[#e5e5e0] bg-[#fdfdfc] shadow-2xl">
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label="Plan2Space demo video"
              className="w-full h-full object-cover opacity-95 group-hover:opacity-100 transition-opacity duration-700"
            >
              <source src="/assets/demo.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-20 h-20 rounded-full border border-white/30 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform duration-500">
                <Play className="w-6 h-6 text-white fill-current translate-x-1" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-32 px-12 py-20 border-t border-[#e5e5e0] bg-[#fdfdfc]">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-start justify-between gap-12">
          <div className="space-y-6">
            <span className="text-xl font-outfit font-medium tracking-[0.2em] uppercase opacity-80">Plan2Space</span>
            <p className="text-[10px] font-medium text-[#999999] max-w-[200px] leading-relaxed">
              {t.footer.slogan}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-24">
            <div className="space-y-4">
              <div className="text-[10px] font-bold uppercase tracking-widest">{t.footer.platform}</div>
              <ul className="space-y-2 text-[10px] font-medium text-[#999999]">
                <li className="hover:text-black cursor-pointer">Studio</li>
                <li className="hover:text-black cursor-pointer">Community</li>
                <li className="hover:text-black cursor-pointer">Engine</li>
              </ul>
            </div>
            <div className="space-y-4">
              <div className="text-[10px] font-bold uppercase tracking-widest">{t.footer.social}</div>
              <ul className="space-y-2 text-[10px] font-medium text-[#999999]">
                <li className="hover:text-black cursor-pointer">Instagram</li>
                <li className="hover:text-black cursor-pointer">Behance</li>
                <li className="hover:text-black cursor-pointer">X</li>
              </ul>
            </div>
            <div className="space-y-4">
              <div className="text-[10px] font-bold uppercase tracking-widest">{t.footer.legal}</div>
              <ul className="space-y-2 text-[10px] font-medium text-[#999999]">
                <li className="hover:text-black cursor-pointer">Privacy</li>
                <li className="hover:text-black cursor-pointer">Terms</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto mt-20 pt-8 border-t border-[#f3f3f1] flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-[#bbbbbb]">
          <span>© 2024 Plan2Space Engine.</span>
          <span>{t.footer.copyright}</span>
        </div>
      </footer>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <NewProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onCreated={() => router.push('/studio')}
      />
    </div>
  );
}
