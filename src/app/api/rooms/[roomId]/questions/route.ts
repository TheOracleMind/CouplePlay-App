import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const text = body?.text?.trim();
  const authorId = body?.authorId;

  if (!text || !authorId) {
    return NextResponse.json({ error: "Question text and authorId are required." }, { status: 400 });
  }

  const { data: question, error } = await supabase
    .from("questions")
    .insert({
      id: crypto.randomUUID(),
      room_id: params.roomId,
      author_id: authorId,
      text,
      answering_player_id: null,
      answer_text: null,
      writer_done: false,
      reader_done: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ question });
}
