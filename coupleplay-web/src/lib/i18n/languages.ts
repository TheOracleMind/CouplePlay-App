export const languages = {
  en: "English",
  "pt-BR": "Português (Brasil)",
} as const;

export type Language = keyof typeof languages;

export const defaultLanguage: Language = "en";

export function detectBrowserLanguage(): Language {
  if (typeof window === "undefined") return defaultLanguage;

  const browserLang = navigator.language || (navigator as any).userLanguage;

  // Check for exact match first
  if (browserLang in languages) {
    return browserLang as Language;
  }

  // Check for Portuguese variants
  if (browserLang.toLowerCase().startsWith("pt")) {
    return "pt-BR";
  }

  return defaultLanguage;
}
