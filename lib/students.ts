/** Shared student login_id / roster helpers (client + server safe). */

export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidLoginId(loginId: string): boolean {
  if (!loginId) return false;
  if (/\s/.test(loginId)) return false;
  return true;
}

export type RosterRowInput = {
  displayName: string;
  loginId: string;
  password: string;
};

export type ParsedRosterRow = RosterRowInput & {
  line: number;
  error?: string;
};

function looksLikeHeader(cols: string[]): boolean {
  const joined = cols.map((c) => c.trim().toLowerCase()).join("|");
  return (
    joined.includes("이름") ||
    joined.includes("아이디") ||
    joined.includes("비밀번호") ||
    joined.includes("name") ||
    joined.includes("login") ||
    joined.includes("password")
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

/**
 * Parse Excel-copied TSV / CSV text into roster rows.
 * Expected columns: 이름, 아이디, 비밀번호 (header optional).
 */
export function parseRosterText(text: string): ParsedRosterRow[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return [];

  let start = 0;
  const firstCols = splitLine(lines[0]);
  if (firstCols.length >= 3 && looksLikeHeader(firstCols)) {
    start = 1;
  }

  const rows: ParsedRosterRow[] = [];

  for (let i = start; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const displayName = (cols[0] ?? "").trim();
    const loginId = normalizeLoginId(cols[1] ?? "");
    const password = (cols[2] ?? "").trim();
    const line = i + 1;
    let error: string | undefined;

    if (!displayName) error = "이름이 비어 있어요";
    else if (!loginId) error = "아이디가 비어 있어요";
    else if (!isValidLoginId(loginId)) error = "아이디에 공백을 넣을 수 없어요";
    else if (!password) error = "비밀번호가 비어 있어요";

    rows.push({ displayName, loginId, password, line, error });
  }

  return rows;
}
