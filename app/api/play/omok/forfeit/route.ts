import { omokForfeitGame } from "@/lib/omok-match";

export async function POST(request: Request) {
  let body: { guestId?: string; gameId?: string | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const result = await omokForfeitGame({
    guestId: body.guestId ?? null,
    gameId: body.gameId ?? null,
  });

  if (!result.ok) {
    return Response.json(result, { status: 400 });
  }

  return Response.json(result);
}
