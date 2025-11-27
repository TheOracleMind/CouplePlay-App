"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GameSlug } from "@/lib/types";

type CreateRoomResponse =
  | { error: string }
  | {
      room: { id: string };
      player: { id: string };
    };

const games: Array<{
  slug: GameSlug;
  title: string;
  gist: string;
  detail: string;
  badge: string;
}> = [
  {
    slug: "random-questions",
    title: "Random Questions",
    gist: "Build a shared list of prompts, then answer live in turns.",
    detail:
      "Stage 1: add questions together (optionally hidden). Stage 2: take turns answering while your partner watches live.",
    badge: "Live typing • Turn-based",
  },
  {
    slug: "idea-matching",
    title: "Idea Matching",
    gist: "Mark what you are both into and reveal your overlaps only.",
    detail:
      "Each person votes yes/no on a shuffled list (custom or preset). Only the ideas you both like are revealed at the end.",
    badge: "Private votes • Shared wins",
  },
];

export default function Home() {
  const [hostName, setHostName] = useState("");
  const [game, setGame] = useState<GameSlug>("random-questions");
  const [hideQuestions, setHideQuestions] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [copied, setCopied] = useState(false);

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
              <p className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium uppercase tracking-wide text-white/80">
                Cozy two-player rooms
              </p>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">
                CouplePlay brings playful prompts to you and your partner.
              </h1>
              <p className="max-w-2xl text-lg text-white/75">
                Create a private room, invite your partner, and dive into lighthearted
                question rounds or idea-matching sessions. Mobile-first and live by
                design.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-white/80">
                <span className="rounded-full bg-white/10 px-4 py-2">1-hour auto cleanup</span>
                <span className="rounded-full bg-white/10 px-4 py-2">Live presence</span>
                <span className="rounded-full bg-white/10 px-4 py-2">No downloads</span>
              </div>
            </div>
            <div className="relative mt-4 w-full max-w-xs overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-white shadow-lg backdrop-blur sm:mt-0">
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-300/30 blur-3xl" />
              <div className="relative space-y-2">
                <p className="text-sm uppercase tracking-wide text-white/70">Tonight&apos;s vibe</p>
                <h2 className="text-xl font-semibold">Two hearts, one room</h2>
                <p className="text-sm text-white/80">
                  Start a room, share the link, and play together in seconds.
                </p>
                <div className="mt-3 flex items-center gap-2 text-sm text-white/75">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-300" />
                  Room links stay alive for 60 minutes of inactivity.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <section className="rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur-lg ring-1 ring-white/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#ff7fa6]">Step 1</p>
                <h2 className="text-2xl font-semibold text-slate-900">Start a room</h2>
                <p className="text-sm text-slate-600">Name yourself, pick a game, and send the invite link.</p>
              </div>
              <span className="rounded-full bg-[#fff0f4] px-3 py-2 text-xs font-medium text-[#bf4776]">
                Host view
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2 text-sm font-medium text-slate-800">
                Your name
                <input
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Jordan, Alex..."
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
                        ? "border-[#ffafc4] bg-[#fff5f9] shadow-lg"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#ffe4ed] px-3 py-1 text-xs font-semibold text-[#bf4776]">
                        {item.badge}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-600">{item.gist}</p>
                    </div>
                    <p className="text-xs text-slate-500">{item.detail}</p>
                  </button>
                ))}
              </div>

              {game === "random-questions" && (
                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={hideQuestions}
                    onChange={(e) => setHideQuestions(e.target.checked)}
                    className="h-5 w-5 rounded-md border-slate-300 text-[#ff7fa6] focus:ring-[#ff7fa6]"
                  />
                  Hide my partner&apos;s questions while we add them
                </label>
              )}

              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !hostName.trim()}
                className="w-full rounded-2xl bg-gradient-to-r from-[#ffafc4] to-[#ff7fa6] px-4 py-3 text-center text-base font-semibold text-slate-900 shadow-lg shadow-[#ffafc4]/40 transition hover:scale-[1.01] disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Creating room..." : "Create room & get link"}
              </button>

              {error && (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              {inviteLink && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">Share this link</p>
                  <p className="break-all rounded-xl bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                    {inviteLink}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={copyLink}
                      className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      {copied ? "Copied!" : "Copy link"}
                    </button>
                    <Link
                      href={inviteLink}
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-800 transition hover:border-[#ff7fa6]"
                    >
                      Open room
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-[#0f172a] p-6 text-white shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#ffafc4]">Step 2</p>
                <h2 className="text-2xl font-semibold">Your partner joins</h2>
                <p className="text-sm text-white/75">They tap the link, enter their name, and you start playing.</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white/80">
                Guest view
              </span>
            </div>

            <div className="mt-6 space-y-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm font-semibold text-white">How it flows</p>
              <ul className="space-y-3 text-sm text-white/80">
                <li>• Tap the shared link to land in the room.</li>
                <li>• Enter your name to join as the second player.</li>
                <li>• Stage 1 depends on the game (questions vs. ideas).</li>
                <li>• Stage 2: take turns answering or voting.</li>
                <li>• Stage 3: view your shared recap.</li>
              </ul>
            </div>

            <div className="mt-4 rounded-2xl bg-[#111c31] p-4 text-sm text-white/80 ring-1 ring-white/5">
              Rooms auto-expire after an hour of inactivity. If you need to restart, just create a fresh room—the flow
              is only a few taps.
            </div>
          </section>
        </div>

        <section className="rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur-lg ring-1 ring-white/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#ff7fa6]">Games</p>
              <h3 className="text-2xl font-semibold text-slate-900">Pick your mood</h3>
              <p className="text-sm text-slate-600">Designed to keep things light, honest, and playful.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
              Mobile-first layout
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {games.map((item) => (
              <div
                key={item.slug}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-lg"
              >
                <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#ffafc4]/30 blur-3xl" />
                <div className="relative space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#ffe4ed] px-3 py-1 text-xs font-semibold text-[#bf4776]">
                      {item.badge}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {item.slug === "random-questions" ? "Stages: Collect → Answer → Recap" : "Stages: Collect/Vote → Reveal"}
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900">{item.title}</h4>
                  <p className="text-sm text-slate-700">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
