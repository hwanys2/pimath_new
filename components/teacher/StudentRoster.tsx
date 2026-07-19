"use client";

import { useActionState } from "react";
import {
  createStudent,
  updateStudent,
  deleteStudent,
  type ActionResult,
} from "@/app/teacher/actions";

const inputClass =
  "w-full min-w-0 rounded-lg border-2 border-wood/15 bg-white px-2.5 py-2 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus:border-sky focus:ring-2 focus:ring-sky/40";

const rowGridClass =
  "grid min-w-[48rem] grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_4.5rem_minmax(0,1.2fr)_auto] items-center gap-2 px-2";

type Student = {
  id: string;
  display_name: string;
  login_id: string;
  level: number;
  total_xp: number;
};

type Props = {
  classId: string;
  students: Student[];
};

const empty: ActionResult = {};

export default function StudentRoster({ classId, students }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-2">
        <div
          className={`${rowGridClass} py-1 text-xs font-bold uppercase tracking-wide text-wood/70`}
        >
          <div>이름</div>
          <div>아이디</div>
          <div>레벨</div>
          <div>비밀번호</div>
          <div className="text-right">관리</div>
        </div>

        {students.map((s) => (
          <StudentRow key={s.id} classId={classId} student={s} />
        ))}
        <NewStudentRow classId={classId} resetToken={students.length} />
      </div>
    </div>
  );
}

function StudentRow({
  classId,
  student,
}: {
  classId: string;
  student: Student;
}) {
  const [state, action, pending] = useActionState(updateStudent, empty);

  return (
    <form
      action={action}
      className={`${rowGridClass} rounded-xl bg-cream/60 py-2`}
    >
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="studentId" value={student.id} />
      <input
        name="displayName"
        defaultValue={student.display_name}
        required
        aria-label="이름"
        className={inputClass}
      />
      <input
        name="loginId"
        defaultValue={student.login_id}
        required
        aria-label="아이디"
        className={inputClass}
      />
      <div className="text-sm font-semibold text-wood whitespace-nowrap">
        Lv.{student.level}
        <span className="mt-0.5 block text-[10px] font-normal text-foreground/45">
          {Number(student.total_xp).toLocaleString()} XP
        </span>
      </div>
      <input
        name="password"
        type="text"
        placeholder="변경 시에만 입력"
        aria-label="비밀번호"
        className={inputClass}
        autoComplete="new-password"
      />
      <div className="flex flex-col items-end gap-1">
        <button
          type="submit"
          disabled={pending}
          className="font-display rounded-lg bg-sky px-3 py-2 text-sm text-[#1a4a6e] shadow-[0_2px_0_rgba(0,0,0,0.15)] disabled:opacity-40"
        >
          {pending ? "저장…" : "저장"}
        </button>
        <button
          type="submit"
          formAction={deleteStudent}
          className="text-xs font-semibold text-[#a63a1a] underline-offset-2 hover:underline"
          onClick={(e) => {
            if (!confirm(`${student.display_name} 학생을 삭제할까요?`)) {
              e.preventDefault();
            }
          }}
        >
          삭제
        </button>
      </div>
      {state.error && (
        <p className="col-span-full rounded-lg bg-peach/40 px-2 py-1 text-xs font-semibold text-[#a63a1a]">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="col-span-full rounded-lg bg-mint/30 px-2 py-1 text-xs font-semibold text-wood">
          {state.message}
        </p>
      )}
    </form>
  );
}

function NewStudentRow({
  classId,
  resetToken,
}: {
  classId: string;
  resetToken: number;
}) {
  const [state, action, pending] = useActionState(createStudent, empty);

  return (
    <form
      key={resetToken}
      action={action}
      className={`${rowGridClass} rounded-xl border-2 border-dashed border-wood/20 bg-white/70 py-2`}
    >
      <input type="hidden" name="classId" value={classId} />
      <input
        name="displayName"
        required
        placeholder="새 학생 이름"
        aria-label="이름"
        className={inputClass}
      />
      <input
        name="loginId"
        required
        placeholder="아이디"
        aria-label="아이디"
        className={inputClass}
      />
      <div className="text-xs text-foreground/40">Lv.1</div>
      <input
        name="password"
        required
        placeholder="비밀번호"
        aria-label="비밀번호"
        className={inputClass}
        autoComplete="new-password"
      />
      <button
        type="submit"
        disabled={pending}
        className="block-btn block-btn-mint font-display justify-self-end px-3 py-2 text-sm disabled:opacity-60"
      >
        {pending ? "추가…" : "추가"}
      </button>
      {state.error && (
        <p className="col-span-full rounded-lg bg-peach/40 px-2 py-1 text-xs font-semibold text-[#a63a1a]">
          {state.error}
        </p>
      )}
    </form>
  );
}
