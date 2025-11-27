import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string; playerId: string }> },
) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set env vars first." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const { roomId, playerId } = await context.params;
  const stageOneDone = Boolean(body?.stage_one_done);

  // Verify player belongs to room
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (playerError || !player) {
    return NextResponse.json({ error: "Player not found in this room." }, { status: 404 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("players")
    .update({ stage_one_done: stageOneDone })
    .eq("id", playerId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If both players are done, advance the room and assign questions.
  const { data: roomPlayers, error: playersError } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId);

  if (playersError) {
    return NextResponse.json({ error: playersError.message }, { status: 500 });
  }

  const host = roomPlayers?.find((p) => p.role === "host");
  const guest = roomPlayers?.find((p) => p.role === "guest");
  const hostDone = Boolean(host?.stage_one_done);
  const guestDone = Boolean(guest?.stage_one_done);

  let roomUpdate: Record<string, unknown> | null = null;

  if (hostDone && guestDone) {
    // Ensure questions have answering_player_id assigned alternately.
    const { data: qs, error: qError } = await supabase
      .from("questions")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (qError) {
      return NextResponse.json({ error: qError.message }, { status: 500 });
    }

    const questionUpdates: Array<Promise<unknown>> = [];
    const playersRoundRobin = [host, guest].filter(Boolean) as typeof host[];
    qs?.forEach((q, idx) => {
      if (!q.answering_player_id && playersRoundRobin.length) {
        const assignee = playersRoundRobin[idx % playersRoundRobin.length];
        if (assignee) {
          questionUpdates.push(
            Promise.resolve(supabase.from("questions").update({ answering_player_id: assignee.id }).eq("id", q.id)),
          );
          q.answering_player_id = assignee.id;
        }
      }
    });
    if (questionUpdates.length) {
      await Promise.all(questionUpdates);
    }

    const next = qs?.find((q) => !(q.writer_done && q.reader_done));
    roomUpdate = {
      stage: qs && qs.length > 0 ? "answer" : "review",
      current_question_id: next ? next.id : null,
    };

    if (roomUpdate) {
      const { error: roomUpdateError } = await supabase.from("rooms").update(roomUpdate).eq("id", roomId);
      if (roomUpdateError) {
        return NextResponse.json({ error: roomUpdateError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ player: updated, roomUpdate });
}
