import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roomId: string; questionId: string }> },
) {
  const supabase = supabaseServer;
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set env vars first." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const { roomId, questionId } = await context.params;

  const fields: Record<string, unknown> = {};
  if (typeof body.answer_text === "string") fields.answer_text = body.answer_text;
  if (typeof body.writer_done === "boolean") fields.writer_done = body.writer_done;
  if (typeof body.reader_done === "boolean") fields.reader_done = body.reader_done;

  // Ensure the question belongs to the room
  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("id, room_id")
    .eq("id", questionId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (questionError || !question) {
    return NextResponse.json({ error: "Question not found in this room." }, { status: 404 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("questions")
    .update(fields)
    .eq("id", questionId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ question: updated });
}
