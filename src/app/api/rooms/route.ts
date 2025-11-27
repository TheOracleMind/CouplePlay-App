import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const hostName = body?.hostName?.trim();
  const game = body?.game ?? "random-questions";
  const hideQuestions = Boolean(body?.hideQuestions);

  if (!hostName) {
    return NextResponse.json({ error: "Host name is required." }, { status: 400 });
  }

  const roomId = crypto.randomUUID();
  const playerId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      id: roomId,
      game,
      hide_questions: hideQuestions,
      stage: "collect",
      current_question_id: null,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (roomError) {
    return NextResponse.json({ error: roomError.message }, { status: 500 });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      id: playerId,
      room_id: roomId,
      name: hostName,
      role: "host",
      stage_one_done: false,
      stage_two_done: false,
    })
    .select()
    .single();

  if (playerError) {
    return NextResponse.json({ error: playerError.message }, { status: 500 });
  }

  return NextResponse.json({ room, player });
}
