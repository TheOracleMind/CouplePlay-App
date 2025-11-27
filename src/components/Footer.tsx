"use client";

import { useLanguage, languages } from "@/lib/i18n";

export function Footer() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <footer className="mt-12 border-t border-white/10 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8 lg:px-12">
        <p className="text-sm text-white/60">
          © 2025 CouplePlay
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/80">{t.footer.language}:</span>
          <div className="flex gap-2">
            {Object.entries(languages).map(([code, name]) => (
              <button
                key={code}
                onClick={() => setLanguage(code as keyof typeof languages)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  language === code
                    ? "bg-[#ffafc4] text-slate-900"
                    : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
