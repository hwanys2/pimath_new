import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const STUDENT_SESSION_COOKIE = "pm_student_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export type StudentSessionPayload = {
  id: string;
  loginId: string;
  displayName: string;
  classId: string;
  className: string;
  teacherId: string;
  /** Opaque DB session token for XP RPCs */
  sessionToken: string;
};

function getSecretKey(): Uint8Array | null {
  const secret = process.env.PM_STUDENT_SESSION_SECRET?.trim();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export async function createStudentSessionToken(
  payload: StudentSessionPayload,
): Promise<string> {
  const key = getSecretKey();
  if (!key) {
    throw new Error("[pm] Missing PM_STUDENT_SESSION_SECRET");
  }

  return new SignJWT({
    loginId: payload.loginId,
    displayName: payload.displayName,
    classId: payload.classId,
    className: payload.className,
    teacherId: payload.teacherId,
    sessionToken: payload.sessionToken,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(key);
}

export async function verifyStudentSessionToken(
  token: string,
): Promise<StudentSessionPayload | null> {
  const key = getSecretKey();
  if (!key) return null;

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });

    const id = typeof payload.sub === "string" ? payload.sub : null;
    const loginId =
      typeof payload.loginId === "string" ? payload.loginId : null;
    const displayName =
      typeof payload.displayName === "string" ? payload.displayName : null;
    const classId =
      typeof payload.classId === "string" ? payload.classId : null;
    const className =
      typeof payload.className === "string" ? payload.className : null;
    const teacherId =
      typeof payload.teacherId === "string" ? payload.teacherId : null;
    const sessionToken =
      typeof payload.sessionToken === "string" ? payload.sessionToken : null;

    if (
      !id ||
      !loginId ||
      !displayName ||
      !classId ||
      !className ||
      !teacherId ||
      !sessionToken
    ) {
      return null;
    }

    return {
      id,
      loginId,
      displayName,
      classId,
      className,
      teacherId,
      sessionToken,
    };
  } catch {
    return null;
  }
}

export async function setStudentSessionCookie(
  payload: StudentSessionPayload,
): Promise<void> {
  const token = await createStudentSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(STUDENT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearStudentSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STUDENT_SESSION_COOKIE);
}

export async function getStudentSession(): Promise<StudentSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyStudentSessionToken(token);
}

export async function getStudentSessionToken(): Promise<string | null> {
  const session = await getStudentSession();
  return session?.sessionToken ?? null;
}
