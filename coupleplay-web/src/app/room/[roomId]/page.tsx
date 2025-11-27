"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameSlug, Player, Question, Room } from "@/lib/types";
import { getBrowserClient } from "@/lib/supabase/client";

export default function RoomPage() {
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

  const stageStartedRef = useRef(false);

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
    if (!supabase || !roomId) return;
    const interval = setInterval(async () => {
      const sorted = getAssignedOrder();
      const current =
        sorted.find((q) => q.id === room?.current_question_id && !isDone(q)) ??
        sorted.find((q) => !isDone(q));
      if (!current) return;
      const writerDraft = draftAnswers[current.id] ?? "";
      const lastSent = lastSentAnswers[current.id] ?? "";
      const isWriter = currentPlayerId && current.answering_player_id === currentPlayerId;
      if (isWriter && writerDraft !== lastSent) {
        setLastSentAnswers((prev) => ({ ...prev, [current.id]: writerDraft }));
        await fetch(`/api/rooms/${roomId}/questions/${current.id}/answer`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer_text: writerDraft }),
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [supabase, roomId, room?.current_question_id, draftAnswers, lastSentAnswers, currentPlayerId, questions]);

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
        fetchedQuestions.forEach((q) => {
          if (typeof q.answer_text === "string" && !next[q.id]) {
            next[q.id] = q.answer_text;
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
        () => void refreshData({ skipLoading: true }),
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
    const gameLabel: Record<GameSlug, string> = {
      "random-questions": "Random Questions",
      "idea-matching": "Idea Matching (not active here)",
    };

    return (
      <header className="rounded-3xl bg-gradient-to-br from-[#1b2437] via-[#141c2f] to-[#0f172a] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-white/70">Private room</p>
            <h1 className="mt-1 text-3xl font-semibold">CouplePlay Session</h1>
            {room?.game && <p className="text-sm text-white/70">{gameLabel[room.game]}</p>}
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-white/80">
            <span className="rounded-full bg-white/10 px-3 py-2">Live</span>
            {room?.stage && <span className="rounded-full bg-white/10 px-3 py-2">Stage: {room.stage}</span>}
            {room?.hide_questions && (
              <span className="rounded-full bg-white/10 px-3 py-2">Hidden questions in stage 1</span>
            )}
          </div>
        </div>
        <p className="mt-4 text-sm text-white/75">
          Invite link already shared. Once both players join and finish stage 1, the turn-based answering begins. Rooms
          expire after 1 hour of inactivity.
        </p>
      </header>
    );
  }

  function renderConnection() {
    const currentPlayer = players.find((p) => p.id === currentPlayerId);
    const guestPresent = players.some((p) => p.role === "guest");

    return (
      <section className="grid gap-4 rounded-3xl bg-white/5 p-5 shadow-2xl ring-1 ring-white/10 md:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white/80">Status</p>
          <div className="flex flex-wrap gap-2 text-sm text-white/80">
            <Badge active={Boolean(room)}>Room ready</Badge>
            <Badge active={players.length >= 1}>Host connected</Badge>
            <Badge active={guestPresent}>Guest connected</Badge>
            <Badge active={Boolean(currentPlayer)}>You are identified</Badge>
          </div>
          {error && <p className="rounded-xl bg-red-100/10 px-3 py-2 text-sm text-red-200">{error}</p>}
          {loading && <p className="text-sm text-white/60">Loading room...</p>}
        </div>
        {!currentPlayer && (
          <div className="space-y-3 rounded-2xl bg-black/50 p-4 ring-1 ring-white/10">
            <p className="text-base font-semibold">Join this room</p>
            <p className="text-sm text-white/70">
              Enter your name to start. The rest of the game will unlock after you join.
            </p>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none ring-2 ring-transparent focus:ring-[#ffafc4]"
            />
            <button
              disabled={!nameInput.trim() || saving}
              onClick={handleJoin}
              className="w-full rounded-xl bg-gradient-to-r from-[#ffafc4] to-[#ff7fa6] px-3 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-[#ffafc4]/40 transition hover:scale-[1.01] disabled:opacity-60"
            >
              {saving ? "Joining..." : "Join as player 2"}
            </button>
          </div>
        )}
        {currentPlayer && (
          <div className="space-y-2 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
            <p className="text-sm font-semibold">You</p>
            <p className="text-base font-semibold text-white">{currentPlayer.name}</p>
            <p className="text-xs text-white/70">Role: {currentPlayer.role}</p>
            <p className="text-xs text-white/70">Share link stays active for 1 hour of inactivity.</p>
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
    const host = players.find((p) => p.role === "host");
    const guest = players.find((p) => p.role === "guest");

    return (
      <section className="rounded-3xl bg-white/90 p-5 text-slate-900 shadow-xl ring-1 ring-white/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#ff7fa6]">Stage 1 - Add questions</p>
            <h2 className="text-2xl font-semibold">Build your list together</h2>
            <p className="text-sm text-slate-600">
              {hide
                ? "Questions are private while you type. They reveal in the answer stage."
                : "Both sides see the list live as you add."}
            </p>
          </div>
          <StageDoneToggle
            label="I'm done adding"
            checked={Boolean(currentPlayer?.stage_one_done)}
            onToggle={() => toggleStageOne(currentPlayer)}
            disabled={!currentPlayer}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
          <span className="rounded-full bg-slate-100 px-3 py-2">
            Host: {host ? (host.stage_one_done ? "Done" : "Working") : "Not joined"}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2">
            Guest: {guest ? (guest.stage_one_done ? "Done" : "Working") : "Not joined"}
          </span>
          {!currentPlayer && (
            <span className="rounded-full bg-red-50 px-3 py-2 text-red-600">
              Join above to mark yourself done
            </span>
          )}
        </div>

        {currentPlayer && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => toggleStageOne(currentPlayer)}
              className={`w-full rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-md transition ${
                currentPlayer.stage_one_done
                  ? "bg-green-600 text-white shadow-green-500/40 hover:opacity-90"
                  : "bg-gradient-to-r from-[#ffafc4] to-[#ff7fa6] text-slate-900 shadow-[#ffafc4]/50 hover:scale-[1.01]"
              }`}
            >
              {currentPlayer.stage_one_done ? "Marked done — waiting for partner" : "Mark me as done adding"}
            </button>
          </div>
        )}

        <div className="mt-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder="Type a question"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none ring-2 ring-transparent focus:ring-[#ffafc4]"
            />
            <button
              disabled={!questionInput.trim() || !currentPlayer}
              onClick={() => currentPlayer && addQuestion(currentPlayer)}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {hide
              ? "Only you see your questions for now. They will be shuffled for answering."
              : "Both partners see the full list live."}
          </p>

          <div className="mt-2 space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            {visibleQuestions.length === 0 && <p className="text-sm text-slate-500">No questions yet.</p>}
            {visibleQuestions.map((q) => (
              <div key={q.id} className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{q.text}</p>
                  <p className="text-xs text-slate-500">
                    {playerName(q.author_id)} - {new Date(q.created_at).toLocaleTimeString()}
                  </p>
                </div>
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
    const isWriter = currentPlayer?.id === current?.answering_player_id;
    const writerDone = Boolean(current?.writer_done);
    const readerDone = Boolean(current?.reader_done);
    const bothDone = writerDone && readerDone;

    return (
      <section className="space-y-4">
        <div className="rounded-3xl bg-white/90 p-5 text-slate-900 shadow-xl ring-1 ring-white/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#ff7fa6]">Stage 2 - Take turns</p>
              <h2 className="text-2xl font-semibold">Answer live, one at a time</h2>
              <p className="text-sm text-slate-600">When both mark a question done, the next one appears automatically.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
              {currentAnsweringPlayer ? `${currentAnsweringPlayer.name}'s turn` : "Preparing..."}
            </div>
          </div>

          {current ? (
            <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">{current.text}</p>
              <p className="text-xs text-slate-500">Answering: {currentAnsweringPlayer?.name ?? "TBD"}</p>
              <p className="text-xs text-slate-500">
                {writerDone ? "Writer done" : isWriter ? "Your turn to type" : "They are typing"} •{" "}
                {readerDone ? "Reader done" : !isWriter ? "Your turn to read" : "They will confirm when read"}
              </p>

              {isWriter ? (
                <div className="space-y-2">
                  <textarea
                    value={draftAnswers[current.id] ?? current.answer_text ?? ""}
                    onChange={(e) => saveAnswer(current, e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-2 ring-transparent focus:ring-[#ffafc4]"
                    rows={4}
                    disabled={writerDone}
                  />
                  <button
                    onClick={() => markWriterDone(current)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                      writerDone
                        ? "bg-green-600 hover:opacity-90"
                        : "bg-slate-900 hover:opacity-90 shadow shadow-slate-200/60"
                    }`}
                    disabled={writerDone || !(draftAnswers[current.id] ?? current.answer_text)?.trim()}
                  >
                    {writerDone ? "Done" : "Mark my answer as done"}
                  </button>
                  {writerDone && !readerDone && (
                    <p className="text-xs text-slate-500">Waiting for your partner to read.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Live typing</p>
                  <p className="min-h-[80px] whitespace-pre-wrap">
                    {draftAnswers[current.id] ?? current.answer_text ?? "Waiting for their answer..."}
                  </p>
                  <button
                    onClick={() => markReaderDone(current)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                      readerDone
                        ? "bg-green-600 hover:opacity-90"
                        : "bg-slate-900 hover:opacity-90 shadow shadow-slate-200/60"
                    }`}
                    disabled={!((draftAnswers[current.id] ?? current.answer_text)?.trim()) || readerDone}
                  >
                    {readerDone ? "Done" : "I read it"}
                  </button>
                  {readerDone && !writerDone && (
                    <p className="text-xs text-slate-500">Waiting for them to mark their answer as done.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Getting the next question ready...</p>
          )}
        </div>

        <div className="rounded-3xl bg-white/5 p-4 text-sm text-white/80 ring-1 ring-white/10">
          Progress: {sorted.filter(isDone).length}/{sorted.length} done. When all are completed, you'll see a recap.
        </div>
      </section>
    );
  }

  function renderReview() {
    const ordered = getAssignedOrder();
    return (
      <section className="rounded-3xl bg-white/90 p-5 text-slate-900 shadow-xl ring-1 ring-white/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#ff7fa6]">Stage 3 - Recap</p>
            <h2 className="text-2xl font-semibold">All answers</h2>
            <p className="text-sm text-slate-600">Read through everything together.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {ordered.map((q) => (
            <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">{q.text}</p>
              <p className="text-xs text-slate-500">
                Answered by {playerName(q.answering_player_id)} - {new Date(q.created_at).toLocaleString()}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{q.answer_text ?? "No answer"}</p>
            </div>
          ))}
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

