"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ForumStoredImage } from "@/lib/forum/types";

export type ForumImageDraft = {
  kept: string[];
  files: File[];
};

type Props = {
  initialImages?: ForumStoredImage[];
  max: number;
  disabled?: boolean;
  onChange: (draft: ForumImageDraft) => void;
};

type LocalFile = {
  key: string;
  file: File;
  url: string;
};

export default function ForumImagePicker({
  initialImages = [],
  max,
  disabled,
  onChange,
}: Props) {
  const inputId = useId();
  const [kept, setKept] = useState(initialImages);
  const [locals, setLocals] = useState<LocalFile[]>([]);
  const localsRef = useRef<LocalFile[]>([]);

  useEffect(() => {
    localsRef.current = locals;
  }, [locals]);

  useEffect(() => {
    return () => {
      for (const item of localsRef.current) URL.revokeObjectURL(item.url);
    };
  }, []);

  const remaining = max - kept.length - locals.length;

  function publish(nextKept: ForumStoredImage[], nextLocals: LocalFile[]) {
    onChange({
      kept: nextKept.map((image) => image.path),
      files: nextLocals.map((item) => item.file),
    });
  }

  function addFiles(list: FileList | null) {
    if (!list || remaining <= 0) return;
    const nextItems = Array.from(list).slice(0, remaining).map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      url: URL.createObjectURL(file),
    }));
    const nextLocals = [...locals, ...nextItems];
    setLocals(nextLocals);
    publish(kept, nextLocals);
  }

  function removeKept(path: string) {
    const nextKept = kept.filter((item) => item.path !== path);
    setKept(nextKept);
    publish(nextKept, locals);
  }

  function removeLocal(key: string) {
    const target = locals.find((item) => item.key === key);
    if (target) URL.revokeObjectURL(target.url);
    const nextLocals = locals.filter((item) => item.key !== key);
    setLocals(nextLocals);
    publish(kept, nextLocals);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {kept.map((image) => (
          <Preview
            key={image.path}
            src={image.url}
            disabled={disabled}
            onRemove={() => removeKept(image.path)}
          />
        ))}
        {locals.map((item) => (
          <Preview
            key={item.key}
            src={item.url}
            disabled={disabled}
            onRemove={() => removeLocal(item.key)}
          />
        ))}
        {remaining > 0 ? (
          <label
            htmlFor={inputId}
            className={`flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-wood/20 bg-white/70 text-center text-xs font-semibold text-wood/70 ${
              disabled ? "pointer-events-none opacity-50" : "hover:bg-white"
            }`}
          >
            그림 넣기
            <span className="mt-1 text-[10px] font-medium text-foreground/40">
              {kept.length + locals.length}/{max}
            </span>
          </label>
        ) : null}
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        disabled={disabled || remaining <= 0}
        className="sr-only"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Preview({
  src,
  disabled,
  onRemove,
}: {
  src: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-wood/10 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white"
        aria-label="그림 빼기"
      >
        ×
      </button>
    </div>
  );
}
