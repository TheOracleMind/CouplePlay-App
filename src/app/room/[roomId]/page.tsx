"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameSlug, Player, Question, Room } from "@/lib/types";
import { getBrowserClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { Footer } from "@/components/Footer";

export default function RoomPage() {
  const { t, interpolate, language } = useLanguage();
  const params = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();

  const roomId = params?.roomId ?? "";
  const searchPlayerId = searchParams.get("player") ?? undefined;
  const supabase = useMemo(() => getBrowserClient(), []);

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [questionInput, setQuestionInput] = useState("");
  const [currentPlayerId, setCurrentPlayerId] = useState<string | undefined>(searchPlayerId);
  const [saving, setSaving] = useState(false);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [lastSentAnswers, setLastSentAnswers] = useState<Record<string, string>>({});
  const [viewKey, setViewKey] = useState(0);
  const [turnKey, setTurnKey] = useState(0);
  const [suggestedQuestion, setSuggestedQuestion] = useState<string>("");
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const stageStartedRef = useRef(false);
  const currentPlayerIdRef = useRef(currentPlayerId);

  // Keep ref in sync with state
  useEffect(() => {
    currentPlayerIdRef.current = currentPlayerId;
  }, [currentPlayerId]);

  useEffect(() => {
    if (currentPlayerId) {
      try {
        localStorage.setItem(`player:${roomId}`, currentPlayerId);
      } catch {
        // ignore storage failures
      }
    }
  }, [currentPlayerId, roomId]);

  useEffect(() => {
    if (searchPlayerId) return;
    try {
      const stored = localStorage.getItem(`player:${roomId}`);
      if (stored) setCurrentPlayerId(stored);
    } catch {
      // ignore storage failures
    }
  }, [roomId, searchPlayerId]);

  useEffect(() => {
    if (!supabase || !roomId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refreshData();
    const cleanup = watchRealtime();
    return () => {
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, roomId]);

  useEffect(() => {
    if (!room || room.stage !== "collect") return;
    const hostDone = players.some((p) => p.role === "host" && p.stage_one_done);
    const guestDone = players.some((p) => p.role === "guest" && p.stage_one_done);
    if (hostDone && guestDone && !stageStartedRef.current) {
      stageStartedRef.current = true;
      void startAnswerStage();
    }
  }, [room, players]);

  useEffect(() => {
    stageStartedRef.current = room?.stage === "collect" ? stageStartedRef.current : false;
    setViewKey((v) => v + 1);
  }, [room?.stage]);

  // Safety: if all questions are done, move to review.
  useEffect(() => {
    if (!supabase || !room) return;
    const ordered = getAssignedOrder();
    const allDone = ordered.length > 0 && ordered.every(isDone);
    if (room.stage === "answer" && allDone) {
      void supabase
        .from("rooms")
        .update({ stage: "review", current_question_id: null })
        .eq("id", roomId)
        .then(() => refreshData({ skipLoading: true }));
    }
  }, [room, questions]); 

  useEffect(() => {
    if (!supabase || !roomId) return;
    const interval = setInterval(() => {
      void refreshData({ skipLoading: true });
    }, 1000);
    return () => clearInterval(interval);
  }, [supabase, roomId]);

  useEffect(() => {
    setTurnKey((k) => k + 1);
  }, [room?.current_question_id]);

  useEffect(() => {
    if (!supabase || !roomId) return;
    const interval = setInterval(async () => {
      const sorted = getAssignedOrder();
      const current =
        sorted.find((q) => q.id === room?.current_question_id && !isDone(q)) ??
        sorted.find((q) => !isDone(q));
      if (!current) return;
      const writerDraft = draftAnswers[current.id] ?? "";
      const lastSent = lastSentAnswers[current.id] ?? "";
      const myPlayerId = currentPlayerIdRef.current; // Use ref for latest value
      const isWriter = myPlayerId && current.answering_player_id === myPlayerId;
      if (isWriter && writerDraft !== lastSent) {
        setLastSentAnswers((prev) => ({ ...prev, [current.id]: writerDraft }));
        await fetch(`/api/rooms/${roomId}/questions/${current.id}/answer`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer_text: writerDraft }),
        });
      }
    }, 500); // Reduced from 1000ms to 500ms for more responsive live typing
    return () => clearInterval(interval);
  }, [supabase, roomId, room?.current_question_id, draftAnswers, lastSentAnswers, questions]);

  function playerName(playerId?: string | null) {
    if (!playerId) return "Unknown";
    return players.find((p) => p.id === playerId)?.name ?? "Unknown";
  }

  function isDone(q: Question) {
    return Boolean(q.writer_done && q.reader_done);
  }

  function getAssignedOrder(): Question[] {
    const ordered = questions
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const missing = ordered.filter((q) => !q.answering_player_id);
    if (!missing.length) return ordered;
    const orderedPlayers = players.slice().sort((a, b) => (a.role === "host" ? -1 : b.role === "host" ? 1 : 0));
    const updates: Array<{ id: string; answering_player_id: string }> = [];
    missing.forEach((q, idx) => {
      const player = orderedPlayers[idx % orderedPlayers.length];
      if (player) {
        q.answering_player_id = player.id;
        updates.push({ id: q.id, answering_player_id: player.id });
      }
    });
    if (updates.length && supabase) {
      void Promise.all(
        updates.map((u) =>
          supabase.from("questions").update({ answering_player_id: u.answering_player_id }).eq("id", u.id),
        ),
      );
    }
    return ordered;
  }

  function nextQuestion(): Question | undefined {
    const ordered = getAssignedOrder();
    return ordered.find((q) => !isDone(q));
  }

  async function refreshData(opts?: { skipLoading?: boolean }) {
    if (!supabase) {
      setError("Supabase not configured.");
      return;
    }
    const skipLoading = opts?.skipLoading;
    if (!skipLoading) setLoading(true);
    try {
      const [roomRes, playersRes, questionsRes] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("players").select("*").eq("room_id", roomId),
        supabase.from("questions").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
      ]);

      if (roomRes.error) throw roomRes.error;
      if (playersRes.error) throw playersRes.error;
      if (questionsRes.error) throw questionsRes.error;

      setRoom(roomRes.data as Room | null);
      setPlayers((playersRes.data ?? []) as Player[]);
      const fetchedQuestions = (questionsRes.data ?? []) as Question[];
      setQuestions(fetchedQuestions);
      setDraftAnswers((prev) => {
        const next = { ...prev };
        const myPlayerId = currentPlayerIdRef.current; // Use ref for latest value
        fetchedQuestions.forEach((q) => {
          if (typeof q.answer_text === "string") {
            // CRITICAL: Only update draft answers for questions being answered by OTHER players
            // This prevents database updates from overwriting the writer's active typing
            const isMyQuestion = q.answering_player_id === myPlayerId;
            const hasDraft = prev[q.id] !== undefined && prev[q.id] !== null;

            if (!isMyQuestion) {
              // It's the other player's turn - always update to show live typing
              next[q.id] = q.answer_text;
            } else if (!hasDraft) {
              // It's my turn but I haven't started typing yet - initialize from database
              // Only initialize if there's NO previous draft (not even empty string)
              next[q.id] = q.answer_text;
            }
            // If it's my turn AND I already have a draft (prev[q.id] is defined),
            // DO NOT overwrite with database value - preserve my active typing
          }
        });
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load room.");
    } finally {
      if (!skipLoading) setLoading(false);
    }
  }

  function watchRealtime() {
    if (!supabase) return;
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new) setRoom(payload.new as Room);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        () => void refreshData({ skipLoading: true }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questions", filter: `room_id=eq.${roomId}` },
        (payload) => {
          // Immediately update the question in state for live typing preview
          if (payload.new) {
            const updatedQuestion = payload.new as Question;
            setQuestions((prev) =>
              prev.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q))
            );
            // ONLY update draft answers for questions being answered by OTHER players (reader view)
            // NEVER update draft answers for questions the current player is answering (writer view)
            const myPlayerId = currentPlayerIdRef.current; // Use ref for latest value
            const isMyQuestion = updatedQuestion.answering_player_id === myPlayerId;

            if (!isMyQuestion) {
              setDraftAnswers((prev) => ({
                ...prev,
                [updatedQuestion.id]: updatedQuestion.answer_text ?? "",
              }));
            }
          }
          void refreshData({ skipLoading: true });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function handleJoin() {
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Unable to join.");
      setCurrentPlayerId(data.player.id);
      setNameInput("");
      await refreshData({ skipLoading: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join.");
    } finally {
      setSaving(false);
    }
  }

  async function addQuestion(currentPlayer: Player) {
    if (!supabase || !questionInput.trim()) return;
    const text = questionInput.trim();
    setQuestionInput("");
    const { error: insertError } = await supabase.from("questions").insert({
      room_id: roomId,
      author_id: currentPlayer.id,
      text,
    });
    if (insertError) setError(insertError.message);
    else await refreshData({ skipLoading: true });
  }

  async function fetchSuggestedQuestion() {
    setLoadingSuggestion(true);
    try {
      const response = await fetch(`/api/suggested-question?lang=${language}`);
      const data = await response.json();
      if (response.ok && data.question) {
        setSuggestedQuestion(data.question);
      } else {
        console.error("Failed to fetch suggested question");
      }
    } catch (error) {
      console.error("Error fetching suggested question:", error);
    } finally {
      setLoadingSuggestion(false);
    }
  }

  async function useSuggestedQuestion(currentPlayer: Player) {
    if (!supabase || !suggestedQuestion.trim()) return;
    const text = suggestedQuestion.trim();
    setSuggestedQuestion("");
    const { error: insertError } = await supabase.from("questions").insert({
      room_id: roomId,
      author_id: currentPlayer.id,
      text,
    });
    if (insertError) setError(insertError.message);
    else {
      await refreshData({ skipLoading: true });
      // Fetch a new suggestion after using one
      await fetchSuggestedQuestion();
    }
  }

  // Fetch initial suggested question when room stage is collect
  useEffect(() => {
    if (room?.stage === "collect" && !suggestedQuestion && !loadingSuggestion) {
      void fetchSuggestedQuestion();
    }
  }, [room?.stage]);

  async function toggleStageOne(currentPlayer?: Player) {
    if (!currentPlayer) return;
    try {
      const next = !currentPlayer.stage_one_done;
      const res = await fetch(`/api/rooms/${roomId}/players/${currentPlayer.id}/stage-one`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_one_done: next }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Unable to update stage state.");

      await refreshData({ skipLoading: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update stage state.");
    }
  }

  async function saveAnswer(question: Question, text: string) {
    setDraftAnswers((prev) => ({ ...prev, [question.id]: text }));
    setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, answer_text: text } : q)));
  }

  async function markWriterDone(question: Question) {
    const latest = draftAnswers[question.id] ?? question.answer_text ?? "";
    if (!latest.trim()) {
      setError("Add an answer before marking done.");
      return;
    }
    try {
      const res = await fetch(`/api/rooms/${roomId}/questions/${question.id}/answer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writer_done: true, answer_text: latest }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Unable to mark done.");
      setQuestions((prev) =>
        prev.map((q) => (q.id === question.id ? { ...q, writer_done: true, answer_text: latest } : q)),
      );
      setDraftAnswers((prev) => ({ ...prev, [question.id]: latest }));
      void triggerAdvance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mark done.");
    }
  }

  async function markReaderDone(question: Question) {
    try {
      const res = await fetch(`/api/rooms/${roomId}/questions/${question.id}/answer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reader_done: true }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Unable to confirm read.");
      setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, reader_done: true } : q)));
      setDraftAnswers((prev) => ({ ...prev }));
      void triggerAdvance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to confirm read.");
    }
  }

  async function assignAnswerers(): Promise<Question[]> {
    if (!supabase) return questions;
    const ordered = questions
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const missing = ordered.filter((q) => !q.answering_player_id);
    if (!missing.length) return ordered;
    const orderedPlayers = players
      .slice()
      .sort((a, b) => (a.role === "host" ? -1 : b.role === "host" ? 1 : 0));
    await Promise.all(
      missing.map((q, idx) => {
        const player = orderedPlayers[idx % orderedPlayers.length];
        if (!player) return Promise.resolve();
        q.answering_player_id = player.id;
        return supabase.from("questions").update({ answering_player_id: player.id }).eq("id", q.id);
      }),
    );
    return ordered;
  }

  async function startAnswerStage() {
    if (!supabase) return;
    const ordered = await assignAnswerers();
    const next = ordered.find((q) => !isDone(q));
    if (!ordered.length) {
      await supabase.from("rooms").update({ stage: "review", current_question_id: null }).eq("id", roomId);
      await refreshData({ skipLoading: true });
      return;
    }
    await supabase
      .from("rooms")
      .update({ stage: "answer", current_question_id: next ? next.id : null })
      .eq("id", roomId);
    await refreshData({ skipLoading: true });
  }

  async function triggerAdvance() {
    await refreshData({ skipLoading: true });
    if (!supabase) return;
    const ordered = getAssignedOrder();
    const next = ordered.find((q) => !isDone(q));

    if (next) {
      await supabase.from("rooms").update({ current_question_id: next.id }).eq("id", roomId);
      setRoom((prev) => (prev ? { ...prev, current_question_id: next.id } : prev));
    } else {
      await supabase.from("rooms").update({ stage: "review", current_question_id: null }).eq("id", roomId);
      setRoom((prev) => (prev ? { ...prev, stage: "review", current_question_id: null } : prev));
    }

    await refreshData({ skipLoading: true });
  }

  function renderHeader() {
    const gameEmoji: Record<GameSlug, string> = {
      "random-questions": "💭",
      "idea-matching": "✨",
    };
    const gameLabel: Record<GameSlug, string> = {
      "random-questions": t.home.games.randomQuestions.title,
      "idea-matching": t.home.games.ideaMatching.title,
    };

    return (
      <header className="rounded-3xl bg-gradient-to-br from-[#1b2437] via-[#141c2f] to-[#0f172a] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
        <div className="space-y-2">
          <div className="text-3xl">{room?.game && gameEmoji[room.game]}</div>
          <h1 className="text-3xl font-bold text-white">
            {room?.game ? gameLabel[room.game] : gameLabel["random-questions"]}
          </h1>
        </div>
        <p className="mt-3 text-base text-white/85">
          {t.room.header.subtitle}
        </p>
      </header>
    );
  }

  function renderConnection() {
    const currentPlayer = players.find((p) => p.id === currentPlayerId);
    const guestPresent = players.some((p) => p.role === "guest");
    const partner = players.find((p) => p.id !== currentPlayerId);

    return (
      <section className="rounded-3xl bg-white/5 p-5 shadow-2xl ring-1 ring-white/10">
        {!currentPlayer && (
          <div className="space-y-3 rounded-2xl bg-black/50 p-4 ring-1 ring-white/10">
            <div className="text-2xl">👋</div>
            <p className="text-lg font-bold">{t.room.connection.welcomeTitle}</p>
            <p className="text-sm text-white/75">
              {t.room.connection.welcomeSubtitle}
            </p>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t.room.connection.namePlaceholder}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white outline-none ring-2 ring-transparent focus:ring-[#ffafc4]"
            />
            <button
              disabled={!nameInput.trim() || saving}
              onClick={handleJoin}
              className="w-full rounded-xl bg-gradient-to-r from-[#ffafc4] to-[#ff7fa6] px-4 py-3 text-base font-bold text-slate-900 shadow-lg shadow-[#ffafc4]/40 transition hover:scale-[1.02] disabled:opacity-60"
            >
              {saving ? t.room.connection.joiningButton : t.room.connection.joinButton}
            </button>
            {error && <p className="rounded-xl bg-red-100/10 px-3 py-2 text-sm text-red-200">{error}</p>}
          </div>
        )}
        {currentPlayer && (
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">👤</div>
              <div>
                <p className="text-sm text-white/70">{t.room.connection.you}</p>
                <p className="text-xl font-bold text-white">{currentPlayer.name}</p>
              </div>
            </div>
            {guestPresent && partner ? (
              <div className="flex items-center gap-3">
                <div className="text-2xl">❤️</div>
                <div>
                  <p className="text-sm text-white/70">{t.room.connection.yourPartner}</p>
                  <p className="text-xl font-bold text-white">{partner.name}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[#ffafc4]" />
                <p className="text-sm text-white/80">{t.room.connection.waitingForPartner}</p>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  function renderCollect(currentPlayer?: Player) {
    const hide = room?.hide_questions;
    const showAll = !hide || currentPlayer?.role === "host";
    const visibleQuestions = showAll
      ? questions
      : questions.filter((q) => q.author_id === currentPlayer?.id);
    const partner = players.find((p) => p.id !== currentPlayer?.id);
    const bothDone = players.length === 2 && players.every((p) => p.stage_one_done);

    return (
      <section className="rounded-3xl bg-white/90 p-6 text-slate-900 shadow-xl ring-1 ring-white/30 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <div className="text-2xl mb-2">✍️</div>
            <h2 className="text-2xl font-bold">{t.room.collect.title}</h2>
            <p className="text-sm text-slate-600 mt-1">
              {hide
                ? t.room.collect.subtitleHidden
                : t.room.collect.subtitleVisible}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-5">
          <div className={`flex items-center gap-2 rounded-full px-4 py-2 ${
            currentPlayer?.stage_one_done ? "bg-green-50 ring-2 ring-green-200" : "bg-slate-100"
          }`}>
            <span className="text-base">👤</span>
            <span className="text-sm font-semibold">
              {currentPlayer?.name || t.room.connection.you}: {currentPlayer?.stage_one_done ? t.room.collect.ready : t.room.collect.addingQuestions}
            </span>
          </div>
          {partner && (
            <div className={`flex items-center gap-2 rounded-full px-4 py-2 ${
              partner.stage_one_done ? "bg-green-50 ring-2 ring-green-200" : "bg-slate-100"
            }`}>
              <span className="text-base">❤️</span>
              <span className="text-sm font-semibold">
                {partner.name}: {partner.stage_one_done ? t.room.collect.ready : t.room.collect.addingQuestions}
              </span>
            </div>
          )}
        </div>

        {currentPlayer && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => toggleStageOne(currentPlayer)}
              className={`w-full rounded-2xl px-4 py-3 text-center text-base font-bold shadow-md transition ${
                currentPlayer.stage_one_done
                  ? "bg-green-600 text-white shadow-green-500/40 hover:opacity-90"
                  : "bg-gradient-to-r from-[#ffafc4] to-[#ff7fa6] text-slate-900 shadow-[#ffafc4]/50 hover:scale-[1.02]"
              }`}
            >
              {currentPlayer.stage_one_done
                ? (bothDone ? t.room.collect.bothReadyWaiting : interpolate(t.room.collect.readyWaitingFor, { partner: partner?.name || "partner" }))
                : t.room.collect.doneButton}
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder={t.room.collect.questionPlaceholder}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-2 ring-transparent focus:ring-[#ffafc4]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && questionInput.trim() && currentPlayer) {
                  addQuestion(currentPlayer);
                }
              }}
            />
            <button
              disabled={!questionInput.trim() || !currentPlayer}
              onClick={() => currentPlayer && addQuestion(currentPlayer)}
              className="rounded-xl bg-slate-900 px-5 py-3 text-base font-bold text-white transition hover:scale-[1.02] disabled:opacity-50"
            >
              {t.room.collect.addButton}
            </button>
          </div>

          {/* Suggested Question */}
          {suggestedQuestion && currentPlayer && (
            <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-5 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💡</span>
                <p className="text-sm font-bold text-purple-900">{t.room.collect.suggestionTitle}</p>
              </div>
              <p className="text-base text-slate-800 mb-4 italic leading-relaxed">"{suggestedQuestion}"</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => useSuggestedQuestion(currentPlayer)}
                  disabled={loadingSuggestion}
                  className="flex-1 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition hover:scale-[1.02] disabled:opacity-50"
                >
                  {t.room.collect.useSuggestion}
                </button>
                <button
                  onClick={fetchSuggestedQuestion}
                  disabled={loadingSuggestion}
                  className="rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-bold text-white transition hover:scale-[1.02] disabled:opacity-50 sm:w-auto"
                >
                  {loadingSuggestion ? t.room.collect.loadingSuggestion : t.room.collect.nextSuggestion}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-2xl border-2 border-slate-200 bg-white p-5 min-h-[140px]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-700">
                {visibleQuestions.length === 0
                  ? t.room.collect.questionsWillAppear
                  : visibleQuestions.length === 1
                    ? interpolate(t.room.collect.questionCount, { count: visibleQuestions.length })
                    : interpolate(t.room.collect.questionCountPlural, { count: visibleQuestions.length })}
              </p>
            </div>
            {visibleQuestions.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">{t.room.collect.startAdding}</p>
            )}
            {visibleQuestions.map((q) => (
              <div key={q.id} className="rounded-xl bg-slate-50 px-4 py-3.5 border border-slate-100 hover:border-slate-200 transition-colors">
                <p className="text-base font-semibold text-slate-800 leading-relaxed">{q.text}</p>
                <p className="text-xs text-slate-500 mt-2">
                  {interpolate(t.room.collect.addedBy, { name: playerName(q.author_id) })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function renderAnswer(currentPlayer?: Player) {
    const sorted = getAssignedOrder();
    const current =
      sorted.find((q) => q.id === room?.current_question_id && !isDone(q)) ??
      sorted.find((q) => !isDone(q)) ??
      sorted[0];
    const currentAnsweringPlayer = current ? players.find((p) => p.id === current.answering_player_id) : undefined;
    const isMyTurn = currentPlayer?.id === current?.answering_player_id;
    const answerSubmitted = Boolean(current?.writer_done);
    const partnerConfirmed = Boolean(current?.reader_done);
    const bothDone = answerSubmitted && partnerConfirmed;
    const completedCount = sorted.filter(isDone).length;
    const totalCount = sorted.length;

    return (
      <section key={turnKey} className="space-y-4 fade-in">
        <div className="rounded-3xl bg-white/90 p-5 text-slate-900 shadow-xl ring-1 ring-white/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-2xl mb-2">💬</div>
              <h2 className="text-2xl font-bold">{t.room.answer.title}</h2>
              <p className="text-sm text-slate-600">{t.room.answer.subtitle}</p>
            </div>
            <div className="rounded-full bg-[#fff5f9] border-2 border-[#ffafc4] px-4 py-2">
              <p className="text-sm font-bold text-slate-900">
                {isMyTurn ? t.room.answer.yourTurn : interpolate(t.room.answer.partnerTurn, { name: currentAnsweringPlayer?.name || "" })}
              </p>
            </div>
          </div>

          {current ? (
            <div className="mt-4 space-y-4 rounded-2xl border-2 border-slate-200 bg-white p-5">
              <div className="rounded-xl bg-[#fff5f9] p-4">
                <p className="text-xs font-semibold text-[#ff7fa6] uppercase mb-1">{t.room.answer.questionLabel}</p>
                <p className="text-lg font-bold text-slate-900">{current.text}</p>
              </div>

              {isMyTurn ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">{t.room.answer.yourAnswerLabel}</p>
                    <textarea
                      value={draftAnswers[current.id] ?? current.answer_text ?? ""}
                      onChange={(e) => saveAnswer(current, e.target.value)}
                      placeholder={t.room.answer.answerPlaceholder}
                      className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base outline-none ring-2 ring-transparent focus:ring-[#ffafc4] focus:border-[#ffafc4]"
                      rows={5}
                      disabled={answerSubmitted}
                    />
                  </div>
                  <button
                    onClick={() => markWriterDone(current)}
                    className={`w-full rounded-xl px-4 py-3 text-base font-bold text-white transition ${
                      answerSubmitted
                        ? "bg-green-600 hover:opacity-90"
                        : "bg-gradient-to-r from-[#ffafc4] to-[#ff7fa6] text-slate-900 hover:scale-[1.02] shadow-lg"
                    }`}
                    disabled={answerSubmitted || !(draftAnswers[current.id] ?? current.answer_text)?.trim()}
                  >
                    {answerSubmitted ? t.room.answer.answerSubmitted : t.room.answer.submitButton}
                  </button>
                  {answerSubmitted && !partnerConfirmed && (
                    <p className="text-sm text-slate-600 text-center">{interpolate(t.room.answer.waitingForPartner, { name: currentAnsweringPlayer?.name === currentPlayer?.name ? t.room.connection.yourPartner : currentAnsweringPlayer?.name || "" })}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-50 p-4 border-2 border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">✍️</span>
                      <p className="text-sm font-semibold text-slate-700">{interpolate(t.room.answer.partnerTyping, { name: currentAnsweringPlayer?.name || "" })}</p>
                    </div>
                    <p className="min-h-[100px] whitespace-pre-wrap text-base text-slate-800">
                      {draftAnswers[current.id] ?? current.answer_text ?? t.room.answer.waitingForAnswer}
                    </p>
                  </div>
                  <button
                    onClick={() => markReaderDone(current)}
                    className={`w-full rounded-xl px-4 py-3 text-base font-bold text-white transition ${
                      partnerConfirmed
                        ? "bg-green-600 hover:opacity-90"
                        : "bg-slate-900 hover:scale-[1.02]"
                    }`}
                    disabled={!((draftAnswers[current.id] ?? current.answer_text)?.trim()) || partnerConfirmed}
                  >
                    {partnerConfirmed ? t.room.answer.confirmed : t.room.answer.confirmButton}
                  </button>
                  {partnerConfirmed && !answerSubmitted && (
                    <p className="text-sm text-slate-600 text-center">{interpolate(t.room.answer.waitingForFinish, { name: currentAnsweringPlayer?.name || "" })}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600 text-center py-4">{t.room.answer.gettingReady}</p>
          )}
        </div>

        <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <p className="text-sm font-semibold text-white">{t.room.answer.progressLabel}</p>
            </div>
            <p className="text-base font-bold text-white">{interpolate(t.room.answer.progressCount, { completed: completedCount, total: totalCount })}</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#ffafc4] to-[#ff7fa6] transition-all duration-500"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      </section>
    );
  }

  function renderReview() {
    const ordered = getAssignedOrder();
    return (
      <section className="rounded-3xl bg-white/90 p-5 text-slate-900 shadow-xl ring-1 ring-white/30">
        <div className="space-y-2">
          <div className="text-3xl">🎉</div>
          <h2 className="text-2xl font-bold">{t.room.review.title}</h2>
          <p className="text-sm text-slate-600">{t.room.review.subtitle}</p>
        </div>
        <div className="mt-5 space-y-4">
          {ordered.map((q, index) => (
            <div key={q.id} className="rounded-2xl border-2 border-slate-200 bg-white p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#fff5f9] flex items-center justify-center">
                  <span className="text-sm font-bold text-[#ff7fa6]">{index + 1}</span>
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-base font-bold text-slate-900">{q.text}</p>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{playerName(q.answering_player_id) === players[0]?.name ? "👤" : "❤️"}</span>
                      <p className="text-xs font-semibold text-slate-600">{interpolate(t.room.review.answeredBy, { name: playerName(q.answering_player_id) })}</p>
                    </div>
                    <p className="whitespace-pre-wrap text-base text-slate-800">{q.answer_text || t.room.review.noAnswer}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl bg-[#fff5f9] border-2 border-[#ffafc4] p-4 text-center">
          <p className="text-base font-semibold text-slate-900">{t.room.review.playAgainTitle}</p>
          <p className="text-sm text-slate-600 mt-1">{t.room.review.playAgainSubtitle}</p>
        </div>
      </section>
    );
  }

  function renderStage() {
    if (!room) return null;
    const currentPlayer = players.find((p) => p.id === currentPlayerId);
    if (!currentPlayer) return null;
    const allDone = getAssignedOrder().length > 0 && getAssignedOrder().every(isDone);
    if (allDone) {
      return renderReview();
    }

    switch (room.stage) {
      case "collect":
        return renderCollect(currentPlayer);
      case "answer":
        return renderAnswer(currentPlayer);
      case "review":
        return renderReview();
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1223] px-5 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {renderHeader()}
        {renderConnection()}
        {currentPlayerId && renderStage()}
      </div>
      <Footer />
    </div>
  );
}

function Badge({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-3 py-2 ${
        active ? "bg-green-200/30 text-green-200 ring-1 ring-green-200/40" : "bg-white/10 text-white/60"
      }`}
    >
      {children}
    </span>
  );
}

function StageDoneToggle({
  label,
  checked,
  onToggle,
  disabled,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        checked
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-slate-200 bg-white text-slate-800 hover:border-[#ff7fa6] hover:shadow"
      }`}
    >
      <span
        className={`h-3 w-3 rounded-full ${
          checked ? "bg-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.25)]" : "bg-slate-300"
        }`}
      />
      {checked ? "Done" : label}
    </button>
  );
}

