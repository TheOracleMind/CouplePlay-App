import { NextRequest, NextResponse } from "next/server";
import { getRandomQuestion, type SupportedLanguage } from "@/lib/data/suggested-questions";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang") || "en";

  // Validate language
  const validLang: SupportedLanguage = lang === "pt-BR" ? "pt-BR" : "en";

  try {
    const question = getRandomQuestion(validLang);
    return NextResponse.json({ question });
  } catch (error) {
    console.error("Error getting random question:", error);
    return NextResponse.json(
      { error: "Failed to get random question" },
      { status: 500 }
    );
  }
}
