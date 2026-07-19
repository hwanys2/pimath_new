"use client";

import { useState, useTransition } from "react";
import { bulkCreateStudents } from "@/app/teacher/actions";
import { parseRosterText, type ParsedRosterRow } from "@/lib/students";

type Props = {
  classId: string;
};

export default function BulkStudentImport({ classId }: Props) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedRosterRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<
    { index: number; loginId: string; message: string }[]
  >([]);
  const [pending, startTransition] = useTransition();

  function runPreview(raw: string) {
    setText(raw);
    setMessage(null);
    setError(null);
    setRowErrors([]);
    const rows = parseRosterText(raw);
    setPreview(rows.length > 0 ? rows : null);
  }

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      runPreview(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  function onSubmit() {
    if (!preview) return;
    const invalid = preview.filter((r) => r.error);
    if (invalid.length > 0) {
      setError("미리보기에 오류가 있는 행이 있어요. 고친 뒤 다시 시도해 주세요.");
      return;
    }

    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await bulkCreateStudents(
        classId,
        preview.map((r) => ({
          displayName: r.displayName,
          loginId: r.loginId,
          password: r.password,
        })),
      );

      if (result.error && !result.createdCount) {
        setError(result.error);
        setRowErrors(result.errors ?? []);
        return;
      }

      setMessage(result.message ?? "등록했어요.");
      setRowErrors(result.errors ?? []);
      if (!result.errors?.length) {
        setText("");
        setPreview(null);
      }
    });
  }

  return (
    <div className="quest-card p-5 sm:p-6">
      <h2 className="font-display text-xl text-wood">엑셀·CSV로 한 번에 등록</h2>
      <p className="mt-1 text-sm text-foreground/65">
        엑셀에서 이름·아이디·비밀번호 세 열을 복사해 붙여 넣거나, CSV 파일을
        올려 주세요.
      </p>

      <textarea
        value={text}
        onChange={(e) => runPreview(e.target.value)}
        rows={6}
        placeholder={"이름\t아이디\t비밀번호\n김민수\tminsu01\t1234\n이서연\tseoyeon\tabcd"}
        className="mt-4 w-full rounded-xl border-2 border-wood/15 bg-white px-4 py-3 font-mono text-sm text-foreground outline-none focus:border-sky focus:ring-2 focus:ring-sky/40"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="font-display cursor-pointer rounded-xl bg-lavender/50 px-4 py-2 text-sm text-[#4a2a7a] transition hover:brightness-105">
          CSV 파일 선택
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          disabled={pending || !preview || preview.length === 0}
          onClick={onSubmit}
          className="block-btn block-btn-sky font-display px-5 py-2 text-sm disabled:opacity-50"
        >
          {pending ? "등록 중…" : "미리보기 그대로 등록"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold text-[#a63a1a]">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-3 rounded-xl bg-mint/40 px-3 py-2 text-sm font-semibold text-wood">
          {message}
        </p>
      )}

      {rowErrors.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-[#a63a1a]">
          {rowErrors.map((e) => (
            <li key={`${e.index}-${e.loginId}`}>
              {e.index + 1}행 ({e.loginId || "—"}): {e.message}
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="text-xs font-bold text-wood/70">
                <th className="px-2 py-1">행</th>
                <th className="px-2 py-1">이름</th>
                <th className="px-2 py-1">아이디</th>
                <th className="px-2 py-1">비밀번호</th>
                <th className="px-2 py-1">상태</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.line} className="border-t border-wood/10">
                  <td className="px-2 py-1.5 text-foreground/50">{r.line}</td>
                  <td className="px-2 py-1.5">{r.displayName || "—"}</td>
                  <td className="px-2 py-1.5 font-mono">{r.loginId || "—"}</td>
                  <td className="px-2 py-1.5 font-mono">
                    {r.password ? "••••" : "—"}
                  </td>
                  <td
                    className={`px-2 py-1.5 font-semibold ${
                      r.error ? "text-[#a63a1a]" : "text-[#1a5c42]"
                    }`}
                  >
                    {r.error ?? "OK"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
