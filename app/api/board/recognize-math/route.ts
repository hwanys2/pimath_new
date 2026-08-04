import { NextResponse } from "next/server";
import { handleRecognizeMath } from "@hwanys2/pm-board/server";

export async function POST(req: Request) {
  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await handleRecognizeMath(body, {
    MATHPIX_APP_ID: process.env.MATHPIX_APP_ID,
    MATHPIX_APP_KEY: process.env.MATHPIX_APP_KEY,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ latex: result.latex, text: result.text });
}
