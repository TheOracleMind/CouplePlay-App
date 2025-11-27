"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Language } from "./languages";
import { defaultLanguage, detectBrowserLanguage } from "./languages";
import { getTranslation, interpolate } from "./translations";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof getTranslation extends (lang: Language) => infer T ? T : never;
  interpolate: typeof interpolate;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "coupleplay-language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Try to get saved language from localStorage
    const savedLang = localStorage.getItem(STORAGE_KEY) as Language | null;

    if (savedLang && (savedLang === "en" || savedLang === "pt-BR")) {
      setLanguageState(savedLang);
    } else {
      // Auto-detect browser language
      const detectedLang = detectBrowserLanguage();
      setLanguageState(detectedLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (isClient) {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  };

  const t = getTranslation(language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, interpolate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
