import { fetchTeacherAssignContext } from "@/lib/teacher-classes";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const keys = url.searchParams
    .get("keys")
    ?.split(",")
    .map((key) => key.trim())
    .filter(Boolean) ?? [];

  const ctx = await fetchTeacherAssignContext(keys);
  return Response.json(
    { ctx },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
