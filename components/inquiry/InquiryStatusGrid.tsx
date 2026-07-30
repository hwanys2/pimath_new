import type { InquiryParticipantRow, InquiryResponseRow } from "@/lib/inquiry-types";
import { INQUIRY_ONLINE_MS } from "@/lib/inquiry-types";

type Props = {
  participants: InquiryParticipantRow[];
  responses: InquiryResponseRow[];
  stepCount: number;
};

function cellSymbol(
  result: string | null | undefined,
): string {
  if (result === "correct") return "O";
  if (result === "wrong") return "X";
  if (result === "neutral") return "·";
  return "";
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < INQUIRY_ONLINE_MS;
}

export default function InquiryStatusGrid({
  participants,
  responses,
  stepCount,
}: Props) {
  const responseMap = new Map<string, Map<number, string | null>>();
  for (const r of responses) {
    if (!responseMap.has(r.studentId)) {
      responseMap.set(r.studentId, new Map());
    }
    responseMap.get(r.studentId)!.set(r.stepIndex, r.result);
  }

  if (participants.length === 0) {
    return (
      <p className="text-sm font-semibold text-foreground/60">
        아직 접속한 학생이 없어요.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-wood/15">
            <th className="sticky left-0 bg-cream px-3 py-2 text-left font-bold text-wood">
              학생
            </th>
            {Array.from({ length: stepCount }, (_, i) => (
              <th
                key={i}
                className="px-2 py-2 text-center font-bold text-wood/80 tabular-nums"
              >
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => {
            const row = responseMap.get(p.studentId);
            const online = isOnline(p.lastSeenAt);
            return (
              <tr key={p.studentId} className="border-b border-wood/10">
                <td className="sticky left-0 bg-cream px-3 py-2 font-semibold text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={[
                        "inline-block h-2 w-2 rounded-full",
                        online ? "bg-mint" : "bg-wood/25",
                      ].join(" ")}
                      title={online ? "온라인" : "오프라인"}
                    />
                    {p.displayName}
                  </span>
                </td>
                {Array.from({ length: stepCount }, (_, i) => (
                  <td
                    key={i}
                    className="px-2 py-2 text-center font-display text-base font-bold tabular-nums text-wood"
                  >
                    {cellSymbol(row?.get(i))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
