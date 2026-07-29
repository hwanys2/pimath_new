import { NextResponse } from "next/server";
import { handleSolveMath } from "@hwanys2/pm-board/server";
import { getActor } from "@/lib/auth";

export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor || actor.type !== "teacher") {
    return NextResponse.json(
      { error: "선생님 계정으로만 풀이를 요청할 수 있어요." },
      { status: 401 },
    );
  }

  let body: {
    latex?: string;
    expr?: string;
    kind?: "equation" | "inequality";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await handleSolveMath(body, {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
