"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GameSlug } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import { Footer } from "@/components/Footer";

type CreateRoomResponse =
  | { error: string }
  | {
      room: { id: string };
      player: { id: string };
    };

export default function Home() {
  const { t } = useLanguage();
  const [hostName, setHostName] = useState("");
  const [game, setGame] = useState<GameSlug>("random-questions");
  const [hideQuestions, setHideQuestions] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Game data with translations
  const games = [
    {
      slug: "random-questions" as GameSlug,
      emoji: "💭",
      get title() {
        return t.home.games.randomQuestions.title;
      },
      get gist() {
        return t.home.games.randomQuestions.gist;
      },
      get detail() {
        return t.home.games.randomQuestions.detail;
      },
    },
    {
      slug: "idea-matching" as GameSlug,
      emoji: "✨",
      get title() {
        return t.home.games.ideaMatching.title;
      },
      get gist() {
        return t.home.games.ideaMatching.gist;
      },
      get detail() {
        return t.home.games.ideaMatching.detail;
      },
    },
  ];

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setInviteLink(null);
    setCopied(false);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName, game, hideQuestions }),
      });

      const data: CreateRoomResponse = await response.json();
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Unable to create room.");
      }

      const link = `${baseUrl}/room/${data.room.id}`;
      setInviteLink(link);
      try {
        localStorage.setItem(`player:${data.room.id}`, data.player.id);
      } catch {
        // ignore storage failures
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen w-full px-5 py-10 sm:px-8 lg:px-12">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="rounded-3xl bg-gradient-to-br from-[#1b2437] via-[#141c2f] to-[#0f172a] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.4)] sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-white sm:text-4xl">
                {t.home.hero.title}
              </h1>
              <p className="max-w-2xl text-lg text-white/85">
                {t.home.hero.subtitle}
              </p>
            </div>
            <div className="relative mt-4 w-full max-w-xs overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 text-white shadow-lg backdrop-blur sm:mt-0">
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-300/30 blur-3xl" />
              <div className="relative space-y-2 text-center">
                <div className="text-3xl">🎮</div>
                <h2 className="text-xl font-semibold">{t.home.hero.readyTitle}</h2>
                <p className="text-sm text-white/80">
                  {t.home.hero.readySubtitle}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <section className="rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur-lg ring-1 ring-white/30">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-900">{t.home.createRoom.title}</h2>
              <p className="text-sm text-slate-600">{t.home.createRoom.subtitle}</p>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2 text-sm font-medium text-slate-800">
                {t.home.createRoom.nameLabel}
                <input
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder={t.home.createRoom.namePlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none ring-2 ring-transparent transition focus:ring-[#ffafc4]"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                {games.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => setGame(item.slug)}
                    className={`relative flex h-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                      game === item.slug
                        ? "border-[#ffafc4] bg-[#fff5f9] shadow-lg ring-2 ring-[#ffafc4]/50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="text-2xl">{item.emoji}</div>
                    <div>
                      <p className="text-base font-bold text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-600 mt-1">{item.gist}</p>
                    </div>
                  </button>
                ))}
              </div>

              {game === "random-questions" && (
                <label className="flex items-center gap-3 rounded-2xl bg-[#fff5f9] border border-[#ffafc4]/30 px-4 py-3 text-sm font-medium text-slate-800 cursor-pointer hover:bg-[#fff0f4] transition">
                  <input
                    type="checkbox"
                    checked={hideQuestions}
                    onChange={(e) => setHideQuestions(e.target.checked)}
                    className="h-5 w-5 rounded-md border-slate-300 text-[#ff7fa6] focus:ring-[#ff7fa6]"
                  />
                  <span>{t.home.createRoom.hideQuestionsLabel}</span>
                </label>
              )}

              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !hostName.trim()}
                className="w-full rounded-2xl bg-gradient-to-r from-[#ffafc4] to-[#ff7fa6] px-4 py-3 text-center text-base font-bold text-slate-900 shadow-lg shadow-[#ffafc4]/40 transition hover:scale-[1.02] hover:shadow-xl disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? t.home.createRoom.creatingButton : t.home.createRoom.createButton}
              </button>

              {error && (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              {inviteLink && (
                <div className="space-y-3 rounded-2xl border-2 border-[#ffafc4] bg-[#fff5f9] p-4 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎉</span>
                    <p className="text-sm font-bold text-slate-800">{t.home.createRoom.roomReady}</p>
                  </div>
                  <p className="break-all rounded-xl bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-[#ffafc4]/30">
                    {inviteLink}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={copyLink}
                      className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:scale-[1.02]"
                    >
                      {copied ? t.home.createRoom.copied : t.home.createRoom.copyLink}
                    </button>
                    <Link
                      href={inviteLink}
                      className="flex-1 rounded-xl bg-gradient-to-r from-[#ffafc4] to-[#ff7fa6] px-3 py-2 text-center text-sm font-bold text-slate-900 transition hover:scale-[1.02]"
                    >
                      {t.home.createRoom.enterRoom}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-[#0f172a] p-6 text-white shadow-2xl ring-1 ring-white/10">
            <div className="space-y-2">
              <div className="text-3xl">💌</div>
              <h2 className="text-2xl font-bold">{t.home.howItWorks.title}</h2>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex gap-3 items-start">
                <span className="text-xl">1️⃣</span>
                <div>
                  <p className="font-semibold text-white">{t.home.howItWorks.step1Title}</p>
                  <p className="text-sm text-white/75">{t.home.howItWorks.step1Desc}</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-xl">2️⃣</span>
                <div>
                  <p className="font-semibold text-white">{t.home.howItWorks.step2Title}</p>
                  <p className="text-sm text-white/75">{t.home.howItWorks.step2Desc}</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-xl">3️⃣</span>
                <div>
                  <p className="font-semibold text-white">{t.home.howItWorks.step3Title}</p>
                  <p className="text-sm text-white/75">{t.home.howItWorks.step3Desc}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-white/70 ring-1 ring-white/5">
              <span className="font-semibold text-white/90">💡 {t.home.howItWorks.tip}</span> {t.home.howItWorks.tipText}
            </div>
          </section>
        </div>

        <section className="rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur-lg ring-1 ring-white/30">
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-slate-900">{t.home.ourGames.title}</h3>
            <p className="text-sm text-slate-600">{t.home.ourGames.subtitle}</p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {games.map((item) => (
              <div
                key={item.slug}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#ffafc4]/30 blur-3xl" />
                <div className="relative space-y-3">
                  <div className="text-3xl">{item.emoji}</div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">{item.title}</h4>
                    <p className="text-sm text-slate-700 mt-1">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
