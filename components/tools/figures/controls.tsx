"use client";

import { useState, type ReactNode } from "react";
import type { LabelMode } from "@/lib/diagrams/circle-chords/model";

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border-2 border-wood/10 bg-white/80 p-4">
      <h2 className="font-display text-base text-wood-dark">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function formatNumberValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(value);
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step: _step = 0.5,
  suffix,
  disabled,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatNumberValue(value);

  function commit(raw: string) {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n)) {
      setDraft(null);
      return;
    }
    let next = n;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    setDraft(null);
    if (next === value) return;
    onChange(next);
  }

  return (
    <label className={`block ${disabled ? "opacity-60" : ""}`}>
      <span className="text-xs font-semibold text-foreground/60">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={shown}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-full rounded-xl border-2 border-wood/20 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-wood disabled:bg-black/5"
        />
        {suffix ? (
          <span className="shrink-0 text-sm text-foreground/50">{suffix}</span>
        ) : null}
      </span>
      {hint ? (
        <span className="mt-1 block text-[11px] text-foreground/45">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold text-foreground/60">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border-2 border-wood/20 bg-white px-3 py-2 text-sm outline-none focus:border-wood"
      />
    </label>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  display,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  display?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-semibold text-foreground/60">
        {label}
        <span className="tabular-nums text-foreground/80">
          {display ?? value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-wood"
      />
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex rounded-xl bg-black/5 p-0.5">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-white text-wood-dark shadow-sm"
                : "text-foreground/55 hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function InlineNumber({
  value,
  onChange,
  min,
  max,
  step = 1,
  ariaLabel,
  className = "w-14",
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <input
      type="number"
      aria-label={ariaLabel}
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`rounded-lg border-2 border-wood/20 bg-white px-1.5 py-1 text-center text-sm tabular-nums outline-none focus:border-wood ${className}`}
    />
  );
}

export function InlineText({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = "min-w-0 flex-1",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border-2 border-wood/20 bg-white px-2 py-1 text-sm outline-none focus:border-wood ${className}`}
    />
  );
}

export function ChipToggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
        on
          ? "bg-wood text-cream"
          : "bg-black/5 text-foreground/60 hover:bg-black/10"
      }`}
    >
      {children}
    </button>
  );
}

const LABEL_MODES: { id: LabelMode; label: string }[] = [
  { id: "auto", label: "숫자" },
  { id: "x", label: "x" },
  { id: "hide", label: "숨김" },
  { id: "custom", label: "직접" },
];

export function LabelModeRow({
  title,
  mode,
  custom,
  unknownLetter,
  onMode,
  onCustom,
}: {
  title: string;
  mode: LabelMode;
  custom: string;
  unknownLetter: string;
  onMode: (m: LabelMode) => void;
  onCustom: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-foreground/50">{title} 표시</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {LABEL_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onMode(m.id)}
            className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
              mode === m.id
                ? "bg-wood/15 text-wood-dark"
                : "bg-black/5 text-foreground/55 hover:bg-black/10"
            }`}
          >
            {m.id === "x" ? unknownLetter : m.label}
          </button>
        ))}
      </div>
      {mode === "x" ? (
        <input
          type="text"
          maxLength={1}
          value={/^[A-Za-z]$/.test(custom.trim()) ? custom.trim() : unknownLetter}
          onChange={(e) => {
            const next = e.target.value.trim();
            onCustom(/^[A-Za-z]$/.test(next) ? next : "");
          }}
          aria-label={`${title} 문자`}
          className="mt-1.5 w-12 rounded-lg border-2 border-wood/20 bg-white px-2 py-1.5 text-center text-sm outline-none focus:border-wood"
        />
      ) : null}
      {mode === "custom" ? (
        <input
          type="text"
          value={custom}
          onChange={(e) => onCustom(e.target.value)}
          placeholder="예: √3  또는  8 cm"
          className="mt-1.5 w-full rounded-lg border-2 border-wood/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-wood"
        />
      ) : null}
    </div>
  );
}
