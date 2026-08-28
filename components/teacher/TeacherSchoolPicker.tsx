"use client";

import { useState, useTransition } from "react";
import {
  searchSchoolsAction,
  setTeacherSchoolAction,
} from "@/app/hof/actions";
import type { SchoolSearchHit, TeacherSchool } from "@/lib/hall-of-fame";

const inputClass =
  "w-full rounded-xl border-2 border-wood/15 bg-white px-4 py-3 text-foreground outline-none transition placeholder:text-foreground/35 focus:border-sky focus:ring-2 focus:ring-sky/40";

type Props = {
  initial: TeacherSchool | null;
};

export default function TeacherSchoolPicker({ initial }: Props) {
  const [school, setSchool] = useState(initial);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SchoolSearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const search = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    startTransition(async () => {
      const next = await searchSchoolsAction(value);
      setHits(next);
    });
  };

  const pick = (hit: SchoolSearchHit) => {
    startTransition(async () => {
      const result = await setTeacherSchoolAction(hit.schoolInfoId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSchool(result);
      setHits([]);
      setQuery("");
      setError(null);
    });
  };

  return (
    <section className="quest-card h-full p-5 sm:p-6">
      <h2 className="font-display text-xl text-wood">우리 학교</h2>
      {school ? (
        <p className="mt-2 text-sm text-foreground/70">
          <span className="font-display text-lg text-foreground">
            {school.schoolName}
          </span>
          {school.region ? (
            <span className="ml-2 text-foreground/50">{school.region}</span>
          ) : null}
          <span className="ml-2 text-[11px] font-semibold text-wood/50">
            {school.source === "foreducator"
              ? "포에듀케이터와 연동됨"
              : "여기서 선택함"}
          </span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-foreground/65">
          학교를 등록하면 학교 대항전에 우리 학교 이름이 올라가요. 포에듀케이터에
          등록된 학교가 있으면 로그인할 때 자동으로 가져옵니다.
        </p>
      )}

      <div className="mt-4">
        <label htmlFor="school-search" className="text-sm font-bold text-wood">
          {school ? "다른 학교로 바꾸기" : "학교 검색"}
        </label>
        <input
          id="school-search"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="학교 이름 두 글자 이상"
          className={`${inputClass} mt-1.5`}
          autoComplete="off"
        />
      </div>

      {isPending && query.trim().length >= 2 && hits.length === 0 ? (
        <p className="mt-2 text-xs text-foreground/40">찾는 중…</p>
      ) : null}

      {hits.length > 0 ? (
        <ul className="mt-2 max-h-56 overflow-auto rounded-xl border border-wood/10 bg-white">
          {hits.map((hit) => (
            <li key={hit.schoolInfoId}>
              <button
                type="button"
                onClick={() => pick(hit)}
                disabled={isPending}
                className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-gold/20"
              >
                <span className="font-bold text-foreground">{hit.schoolName}</span>
                {hit.region ? (
                  <span className="shrink-0 text-xs text-foreground/45">
                    {hit.region}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-peach/40 px-3 py-2 text-sm font-semibold text-[#a63a1a]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
