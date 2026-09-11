"use client";

import { useEffect, useRef, useState } from "react";

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export default function MailRichTextEditor({
  value,
  onChange,
  placeholder = "본문을 입력하세요",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [htmlMode, setHtmlMode] = useState(false);

  useEffect(() => {
    if (htmlMode) return;
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value) el.innerHTML = value || "";
  }, [value, htmlMode]);

  function ToolButton({
    label,
    title,
    onClick,
    active,
  }: {
    label: string;
    title: string;
    onClick: () => void;
    active?: boolean;
  }) {
    return (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
          active
            ? "bg-wood/20 text-wood-dark"
            : "text-wood/70 hover:bg-wood/10 hover:text-wood-dark"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-wood/20 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-wood/10 bg-wood/5 p-1.5">
        <ToolButton
          label="H2"
          title="제목"
          onClick={() => exec("formatBlock", "H2")}
        />
        <ToolButton
          label="본문"
          title="본문"
          onClick={() => exec("formatBlock", "P")}
        />
        <span className="mx-1 h-4 w-px bg-wood/20" aria-hidden />
        <ToolButton label="B" title="굵게" onClick={() => exec("bold")} />
        <ToolButton label="I" title="기울임" onClick={() => exec("italic")} />
        <ToolButton label="U" title="밑줄" onClick={() => exec("underline")} />
        <span className="mx-1 h-4 w-px bg-wood/20" aria-hidden />
        <ToolButton
          label="목록"
          title="기호 목록"
          onClick={() => exec("insertUnorderedList")}
        />
        <ToolButton
          label="번호"
          title="번호 목록"
          onClick={() => exec("insertOrderedList")}
        />
        <ToolButton
          label="링크"
          title="링크"
          onClick={() => {
            const url = window.prompt("링크 주소 (https://…)");
            if (url) exec("createLink", url);
          }}
        />
        <span className="mx-1 h-4 w-px bg-wood/20" aria-hidden />
        <ToolButton
          label={htmlMode ? "미리보기" : "HTML"}
          title={htmlMode ? "보이는 편집기로 전환" : "HTML 코드로 전환"}
          active={htmlMode}
          onClick={() => setHtmlMode((v) => !v)}
        />
      </div>

      {htmlMode ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[280px] w-full resize-y bg-stone-50 p-4 font-mono text-xs leading-relaxed text-wood-dark outline-none"
          placeholder="HTML 소스"
          spellCheck={false}
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={(e) => onChange(e.currentTarget.innerHTML)}
          className="mail-rte min-h-[280px] w-full p-4 text-sm leading-relaxed text-wood-dark outline-none empty:before:text-wood/40 empty:before:content-[attr(data-placeholder)]"
        />
      )}
    </div>
  );
}
