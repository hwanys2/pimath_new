import { OPEN_CHAT_URL } from "@/lib/site-links";

type Props = {
  className?: string;
  variant?: "text" | "button";
};

const variantClass = {
  text: "inline-flex items-center gap-1 text-xs font-semibold text-wood/75 transition hover:text-wood",
  button:
    "inline-flex items-center justify-center gap-1.5 rounded-xl border border-wood/20 bg-wood/5 px-4 py-2 text-sm font-semibold text-wood/80 transition hover:border-wood/35 hover:bg-wood/10 hover:text-wood",
};

export default function OpenChatLink({
  className = "",
  variant = "text",
}: Props) {
  return (
    <a
      href={OPEN_CHAT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${variantClass[variant]} ${className}`.trim()}
    >
      💬 오픈채팅방 참여
      <span aria-hidden className="text-[10px] opacity-50">
        ↗
      </span>
    </a>
  );
}
