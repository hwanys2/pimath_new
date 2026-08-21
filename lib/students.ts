/** Shared student login_id / roster helpers (client + server safe). */

export const STUDENT_NUMBER_MIN = 1;
export const STUDENT_NUMBER_MAX = 999;

export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidLoginId(loginId: string): boolean {
  if (!loginId) return false;
  if (/\s/.test(loginId)) return false;
  return true;
}

export type RosterRowInput = {
  studentNumber: number | null;
  displayName: string;
  loginId: string;
  password: string;
};

export type ParsedRosterRow = RosterRowInput & {
  line: number;
  error?: string;
};

export function parseStudentNumber(
  raw: string | number | null | undefined,
): { value: number | null; error?: string } {
  if (raw == null) return { value: null };
  const text = String(raw).trim();
  if (!text) return { value: null };
  if (!/^\d+$/.test(text)) {
    return { value: null, error: "번호는 숫자여야 해요" };
  }
  const n = Number(text);
  if (
    !Number.isInteger(n) ||
    n < STUDENT_NUMBER_MIN ||
    n > STUDENT_NUMBER_MAX
  ) {
    return {
      value: null,
      error: `번호는 ${STUDENT_NUMBER_MIN}–${STUDENT_NUMBER_MAX} 사이여야 해요`,
    };
  }
  return { value: n };
}

export function formatStudentLabel(
  displayName: string,
  studentNumber?: number | null,
): string {
  if (studentNumber == null) return displayName;
  return `${studentNumber}번 ${displayName}`;
}

export function compareStudentsByNumber(
  a: {
    studentNumber?: number | null;
    displayName?: string;
    loginId?: string;
  },
  b: {
    studentNumber?: number | null;
    displayName?: string;
    loginId?: string;
  },
): number {
  const an = a.studentNumber ?? null;
  const bn = b.studentNumber ?? null;
  if (an != null && bn != null && an !== bn) return an - bn;
  if (an != null && bn == null) return -1;
  if (an == null && bn != null) return 1;
  const name = (a.displayName ?? "").localeCompare(b.displayName ?? "", "ko");
  if (name !== 0) return name;
  return (a.loginId ?? "").localeCompare(b.loginId ?? "", "ko");
}

export function withStudentRosterOrder<
  T extends {
    order: (
      column: string,
      options?: { ascending?: boolean; nullsFirst?: boolean },
    ) => T;
  },
>(query: T): T {
  return query
    .order("student_number", { ascending: true, nullsFirst: false })
    .order("display_name", { ascending: true })
    .order("login_id", { ascending: true });
}

type ColKind = "number" | "name" | "login" | "password";

function headerKind(cell: string): ColKind | null {
  const c = cell.trim().toLowerCase().replace(/\s+/g, "");
  if (
    c === "번호" ||
    c === "출석번호" ||
    c === "번호." ||
    c === "#" ||
    c === "no" ||
    c === "num" ||
    c === "number" ||
    c === "studentnumber" ||
    c === "student_number" ||
    c === "student_no"
  ) {
    return "number";
  }
  if (
    c === "이름" ||
    c === "성명" ||
    c === "학생이름" ||
    c === "name" ||
    c === "displayname" ||
    c === "display_name"
  ) {
    return "name";
  }
  if (
    c === "아이디" ||
    c === "id" ||
    c === "login" ||
    c === "loginid" ||
    c === "login_id"
  ) {
    return "login";
  }
  if (
    c === "비밀번호" ||
    c === "비번" ||
    c === "password" ||
    c === "pw" ||
    c === "pass"
  ) {
    return "password";
  }
  return null;
}

function looksLikeHeader(cols: string[]): boolean {
  const joined = cols.map((c) => c.trim().toLowerCase()).join("|");
  return (
    joined.includes("이름") ||
    joined.includes("아이디") ||
    joined.includes("비밀번호") ||
    joined.includes("번호") ||
    joined.includes("name") ||
    joined.includes("login") ||
    joined.includes("password") ||
    joined.includes("number")
  );
}

function splitLine(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((c) => c.trim());
  }
  // Simple CSV: split on commas not inside quotes
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cols.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function columnIndex(kinds: Array<ColKind | null>, kind: ColKind): number {
  return kinds.indexOf(kind);
}

function cellsForRow(
  cols: string[],
  headerKinds: Array<ColKind | null> | null,
): { studentNumber: string; displayName: string; loginId: string; password: string } {
  if (headerKinds) {
    const nameIdx = columnIndex(headerKinds, "name");
    const loginIdx = columnIndex(headerKinds, "login");
    const passwordIdx = columnIndex(headerKinds, "password");
    const numberIdx = columnIndex(headerKinds, "number");
    if (nameIdx >= 0 && loginIdx >= 0 && passwordIdx >= 0) {
      return {
        studentNumber: numberIdx >= 0 ? (cols[numberIdx] ?? "") : "",
        displayName: cols[nameIdx] ?? "",
        loginId: cols[loginIdx] ?? "",
        password: cols[passwordIdx] ?? "",
      };
    }
  }

  if (cols.length >= 4) {
    return {
      studentNumber: cols[0] ?? "",
      displayName: cols[1] ?? "",
      loginId: cols[2] ?? "",
      password: cols[3] ?? "",
    };
  }

  return {
    studentNumber: "",
    displayName: cols[0] ?? "",
    loginId: cols[1] ?? "",
    password: cols[2] ?? "",
  };
}

/**
 * Parse Excel-copied TSV / CSV text into roster rows.
 * Expected columns: 번호, 이름, 아이디, 비밀번호 (header optional).
 * Legacy 3-column 이름, 아이디, 비밀번호 is still accepted.
 */
export function parseRosterText(text: string): ParsedRosterRow[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return [];

  let start = 0;
  let headerKinds: Array<ColKind | null> | null = null;
  const firstCols = splitLine(lines[0]);
  if (looksLikeHeader(firstCols)) {
    start = 1;
    headerKinds = firstCols.map(headerKind);
  }

  const rows: ParsedRosterRow[] = [];

  for (let i = start; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const cells = cellsForRow(cols, headerKinds);
    const displayName = cells.displayName.trim();
    const loginId = normalizeLoginId(cells.loginId);
    const password = cells.password.trim();
    const parsedNumber = parseStudentNumber(cells.studentNumber);
    const line = i + 1;
    let error: string | undefined;

    if (parsedNumber.error) error = parsedNumber.error;
    else if (!displayName) error = "이름이 비어 있어요";
    else if (!loginId) error = "아이디가 비어 있어요";
    else if (!isValidLoginId(loginId)) error = "아이디에 공백을 넣을 수 없어요";
    else if (!password) error = "비밀번호가 비어 있어요";

    rows.push({
      studentNumber: parsedNumber.value,
      displayName,
      loginId,
      password,
      line,
      error,
    });
  }

  return rows;
}
