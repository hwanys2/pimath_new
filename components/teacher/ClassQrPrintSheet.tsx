"use client";

import { rotateStudentQrToken } from "@/app/teacher/actions";
import { downloadDataUrl } from "@/components/teacher/downloadDataUrl";
import { studentQrFileName } from "@/lib/student-qr";

export type QrCardStudent = {
  id: string;
  displayName: string;
  loginId: string;
  qrDataUrl: string;
};

export default function ClassQrPrintSheet({
  classId,
  className,
  students,
}: {
  classId: string;
  className: string;
  students: QrCardStudent[];
}) {
  return (
    <div>
      <div className="no-print mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground/65">
            인쇄해서 잘라 교과서에 붙이세요. 같은 QR은 학기 내내 다시 찍어도
            들어갑니다.
          </p>
          <button
            type="button"
            onClick={() => window.print()}
            className="block-btn block-btn-mint font-display px-5 py-2.5 text-sm"
          >
            인쇄
          </button>
        </div>
        <p className="rounded-xl bg-peach/30 px-3 py-2 text-xs leading-relaxed text-[#6b4423]">
          교사용 태블릿·컴퓨터에서는 학생 QR을 찍지 마세요. 교사 로그인이
          풀리고 그 학생으로 들어갑니다. QR 사진이 유출되면 그 학생으로 들어갈
          수 있어요. 그때는 아래{" "}
          <span className="font-semibold">QR 다시 만들기</span>로 이전 스티커를
          무효화하세요.
        </p>
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-foreground/60">아직 명단에 학생이 없어요.</p>
      ) : (
        <div className="qr-print-grid grid grid-cols-1 gap-4 sm:grid-cols-2">
          {students.map((student) => (
            <QrPrintCard
              key={student.id}
              classId={classId}
              className={className}
              student={student}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QrPrintCard({
  classId,
  className,
  student,
}: {
  classId: string;
  className: string;
  student: QrCardStudent;
}) {
  return (
    <article className="qr-print-card flex flex-col items-center gap-2 rounded-2xl border-2 border-wood/15 bg-white p-4">
      <p className="text-[11px] font-semibold tracking-wide text-wood/70">
        수학하는 즐거움
      </p>
      <p className="text-xs text-foreground/55">{className}</p>
      <h3 className="font-display text-xl text-foreground">
        {student.displayName}
      </h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={student.qrDataUrl}
        alt={`${student.displayName} 로그인 QR`}
        className="h-44 w-44 rounded-xl border border-wood/10"
      />
      <p className="text-center text-[11px] text-foreground/55">
        카메라로 찍으면 바로 입장
      </p>
      <p className="text-[11px] text-wood/60">{student.loginId}</p>

      <div className="no-print mt-1 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="text-xs font-semibold text-wood underline-offset-2 hover:underline"
          onClick={() => {
            downloadDataUrl(
              student.qrDataUrl,
              studentQrFileName(student.displayName),
            );
          }}
        >
          PNG 저장
        </button>
        <form
          action={rotateStudentQrToken}
          onSubmit={(e) => {
            if (
              !confirm(
                `${student.displayName} 학생 QR을 다시 만들까요? 이미 붙여 둔 QR은 더 이상 안 됩니다.`,
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="studentId" value={student.id} />
          <button
            type="submit"
            className="text-xs font-semibold text-[#a63a1a] underline-offset-2 hover:underline"
          >
            QR 다시 만들기
          </button>
        </form>
      </div>
    </article>
  );
}
