import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Language = 'en' | 'ko';

interface LanguageState {
    language: Language;
    setLanguage: (lang: Language) => void;
    toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            language: 'ko', // Default to Korean as per user context (likely Korean user based on request)
            setLanguage: (lang) => set({ language: lang }),
            toggleLanguage: () =>
                set((state) => ({ language: state.language === 'en' ? 'ko' : 'en' })),
        }),
        {
            name: 'language-storage',
        }
    )
);
