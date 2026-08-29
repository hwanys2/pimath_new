import { getActor } from "@/lib/auth";

export async function GET() {
  const actor = await getActor();
  return Response.json(
    { actor },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
