import { OPEN_CHAT_URL } from "@/lib/site-links";

type Props = {
  className?: string;
};

export default function OpenChatLink({ className = "" }: Props) {
  return (
    <a
      href={OPEN_CHAT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-xs font-semibold text-wood/75 transition hover:text-wood ${className}`.trim()}
    >
      💬 오픈채팅방 참여
      <span aria-hidden className="text-[10px] opacity-50">
        ↗
      </span>
    </a>
  );
}
