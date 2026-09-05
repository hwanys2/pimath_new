"use server";

import { getStudentSessionToken } from "@/lib/student-session";

/** One-shot opaque DB session token for browser→Supabase RPC polls/pings. */
export async function getStudentRpcCredentialsAction(): Promise<{
  sessionToken: string | null;
}> {
  const sessionToken = await getStudentSessionToken();
  return { sessionToken };
}
