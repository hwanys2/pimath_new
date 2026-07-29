import { NextResponse } from "next/server";
import { handleRecognizeMath } from "@hwanys2/pm-board/server";
import { getActor } from "@/lib/auth";

export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor || actor.type !== "teacher") {
    return NextResponse.json(
      { error: "선생님 계정으로 로그인해야 수식 인식을 사용할 수 있어요." },
      { status: 401 },
    );
  }

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
