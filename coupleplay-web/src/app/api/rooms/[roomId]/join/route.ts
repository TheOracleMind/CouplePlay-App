import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set env vars first." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const name = body?.name?.trim();
  const { roomId } = await context.params;

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // If a guest already exists, reuse it; otherwise create one.
  const { data: existingGuest, error: existingGuestError } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .eq("role", "guest")
    .limit(1)
    .single();

  if (existingGuestError && existingGuestError.code !== "PGRST116") {
    // PGRST116 = no rows
    return NextResponse.json({ error: existingGuestError.message }, { status: 500 });
  }

  if (existingGuest) {
    const { data: updated, error: updateError } = await supabase
      .from("players")
      .update({ name })
      .eq("id", existingGuest.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ room, player: updated });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      room_id: roomId,
      name,
      role: "guest",
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
