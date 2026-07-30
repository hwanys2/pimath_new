type Props = {
  className?: string;
  studentName?: string | null;
};

export default function InquiryWaitingScreen({
  className = "",
  studentName,
}: Props) {
  return (
    <section
      className={[
        "quest-card flex flex-col items-center justify-center p-8 text-center sm:p-12",
        className,
      ].join(" ")}
    >
      <p className="font-display text-2xl text-wood sm:text-3xl">대기 중</p>
      <p className="mt-4 max-w-md text-sm font-semibold leading-relaxed text-foreground/70">
        {studentName ? (
          <>
            <span className="text-wood">{studentName}</span>님, 선생님이 수업을
            시작할 때까지 기다려 주세요.
          </>
        ) : (
          "선생님이 수업을 시작할 때까지 기다려 주세요."
        )}
      </p>
      <p className="mt-3 text-xs font-medium text-foreground/50">
        수업이 시작되면 선생님 속도에 맞춰 문제가 진행돼요.
      </p>
    </section>
  );
}
