export type GameSlug = "random-questions" | "idea-matching";

export type RoomStage = "collect" | "answer" | "review";

export interface Room {
  id: string;
  game: GameSlug;
  hide_questions: boolean;
  stage: RoomStage;
  current_question_id: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  role: "host" | "guest";
  stage_one_done?: boolean;
  stage_two_done?: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  room_id: string;
  author_id: string;
  text: string;
  answering_player_id: string | null;
  answer_text?: string | null;
  writer_done?: boolean | null;
  reader_done?: boolean | null;
  created_at: string;
}
