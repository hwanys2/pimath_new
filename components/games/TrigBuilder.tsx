"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { RankingMode, RankingRow, RankingScope } from "@/lib/game-types";
import GameRankingBoard from "@/components/games/GameRankingBoard";
import TrigBuilderScene, {
  type SceneStatus,
} from "@/components/games/TrigBuilderScene";
import {
  submitGameRun,
  fetchGameRanking,
  type GameSubmitClientResult,
} from "@/app/adventure/actions";
import { activityDetailsV1 } from "@/lib/activity-result-schemas";
import {
  CONTENT_KEY,
  STAGES,
  STAGE_COUNT,
  type Block,
  type ExpressionSlots,
  type SlotKind,
  type StageDef,
  applyScoreGain,
  bridgeRatio,
  buildInventory,
  emptySlots,
  expressionLatex,
  isExpressionCorrect,
  pointsForStage,
  sideLabelKo,
} from "@/lib/trig-builder-math";

type Phase = "ready" | "playing" | "animating" | "ended";

type DragState = {
  block: Block;
  x: number;
  y: number;
  startX: number;
  startY: number;
  fromSlot: SlotKind | null;
};

function Latex({ latex, className }: { latex: string; className?: string }) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      }),
    [latex],
  );
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function BlockChip({
  block,
  selected,
  dimmed,
  onPointerDown,
  onClick,
}: {
  block: Block;
  selected?: boolean;
  dimmed?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: () => void;
}) {
  const color =
    block.kind === "length"
      ? "border-gold/60 bg-gold/40 text-wood"
      : block.kind === "trig"
        ? "border-lavender/70 bg-lavender/45 text-wood"
        : "border-sky/70 bg-sky/45 text-wood";

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={onClick}
      className={[
        "touch-none select-none rounded-xl border-2 px-3 py-2 text-sm font-black tabular-nums shadow-sm transition",
        color,
        selected ? "ring-2 ring-wood scale-105" : "",
        dimmed ? "opacity-35" : "hover:brightness-105 active:scale-95",
      ].join(" ")}
      aria-label={`${block.kind} 블록 ${block.label}`}
    >
      {block.kind === "trig" ? (
        <Latex latex={`\\${block.value}`} />
      ) : block.kind === "angle" ? (
        <Latex latex={`${block.value}^\\circ`} />
      ) : (
        block.label
      )}
    </button>
  );
}

function SlotWell({
  kind,
  block,
  highlight,
  onClear,
  onDropClick,
  slotRef,
}: {
  kind: SlotKind;
  block: Block | null;
  highlight?: boolean;
  onClear: () => void;
  onDropClick: () => void;
  slotRef: (el: HTMLDivElement | null) => void;
}) {
  const label =
    kind === "length" ? "길이" : kind === "trig" ? "삼각비" : "각도";
  return (
    <div
      ref={slotRef}
      onClick={() => {
        if (block) onClear();
        else onDropClick();
      }}
      className={[
        "flex min-h-[52px] min-w-[72px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-3 py-2 transition",
        highlight
          ? "border-wood bg-lavender/30 scale-105"
          : block
            ? "border-wood/40 bg-white/80"
            : "border-wood/25 bg-wood/5",
      ].join(" ")}
      role="button"
      tabIndex={0}
      aria-label={`${label} 슬롯${block ? `: ${block.label}` : " (비어 있음)"}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (block) onClear();
          else onDropClick();
        }
      }}
    >
      <span className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-wood/45">
        {label}
      </span>
      {block ? (
        <BlockChip block={block} />
      ) : (
        <span className="text-xs font-semibold text-wood/35">비움</span>
      )}
    </div>
  );
}

export default function TrigBuilder() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [stageIndex, setStageIndex] = useState(0);
  const [slots, setSlots] = useState<ExpressionSlots>(emptySlots);
  const [score, setScore] = useState(0);
  const [stageWrong, setStageWrong] = useState(0);
  const [totalWrong, setTotalWrong] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverSlot, setHoverSlot] = useState<SlotKind | null>(null);
  const [submitResult, setSubmitResult] =
    useState<GameSubmitClientResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingScope, setRankingScope] = useState<RankingScope>("class");
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [isPending, startTransition] = useTransition();

  const slotEls = useRef<Partial<Record<SlotKind, HTMLDivElement | null>>>({});
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const dragRef = useRef<DragState | null>(null);

  const stage: StageDef = STAGES[stageIndex]!;
  const inventory = useMemo(() => buildInventory(stage), [stage]);
  const placedIds = useMemo(() => {
    const ids = new Set<string>();
    if (slots.length) ids.add(slots.length.id);
    if (slots.trig) ids.add(slots.trig.id);
    if (slots.angle) ids.add(slots.angle.id);
    return ids;
  }, [slots]);

  const ratio = bridgeRatio(slots, stage);
  const latex = expressionLatex(slots);
  const canConfirm =
    phase === "playing" &&
    !!slots.length &&
    !!slots.trig &&
    !!slots.angle &&
    sceneStatus === "idle";

  const resetStageLocal = useCallback((idx: number) => {
    setStageIndex(idx);
    setSlots(emptySlots());
    setStageWrong(0);
    setSceneStatus("idle");
    setFeedback(null);
    setSelectedBlock(null);
    setDrag(null);
    setHoverSlot(null);
  }, []);

  const startFresh = useCallback(() => {
    setScore(0);
    setTotalWrong(0);
    setCleared(0);
    setSubmitResult(null);
    setRanking([]);
    setRankingScope("class");
    setRankingMode("best");
    resetStageLocal(0);
    setPhase("playing");
  }, [resetStageLocal]);

  const endRun = useCallback(
    (finalScore: number, clearedCount: number, wrongs: number) => {
      setPhase("ended");
      startTransition(async () => {
        const result = await submitGameRun({
          contentKey: CONTENT_KEY,
          score: finalScore,
          details: activityDetailsV1({
            cleared: clearedCount,
            stages: STAGE_COUNT,
            wrongAttempts: wrongs,
          }),
        });
        setSubmitResult(result);
        if (result.recorded) {
          const rows = await fetchGameRanking({
            contentKey: CONTENT_KEY,
            scope: "class",
            mode: "best",
          });
          setRanking(rows);
        }
      });
    },
    [startTransition],
  );

  const loadRanking = useCallback(
    async (opts?: { scope?: RankingScope; mode?: RankingMode }) => {
      const scope = opts?.scope ?? rankingScope;
      const mode = opts?.mode ?? rankingMode;
      if (opts?.scope) setRankingScope(opts.scope);
      if (opts?.mode) setRankingMode(opts.mode);
      startTransition(async () => {
        const rows = await fetchGameRanking({
          contentKey: CONTENT_KEY,
          scope,
          mode,
        });
        setRanking(rows);
      });
    },
    [rankingMode, rankingScope, startTransition],
  );

  const placeBlock = useCallback((block: Block, slot: SlotKind) => {
    if (block.kind !== slot) return false;
    setSlots((prev) => {
      const next = { ...prev };
      // Return previous occupant of this slot to inventory automatically
      if (slot === "length") next.length = block as ExpressionSlots["length"];
      if (slot === "trig") next.trig = block as ExpressionSlots["trig"];
      if (slot === "angle") next.angle = block as ExpressionSlots["angle"];
      return next;
    });
    setSelectedBlock(null);
    setFeedback(null);
    return true;
  }, []);

  const clearSlot = useCallback((kind: SlotKind) => {
    setSlots((prev) => ({ ...prev, [kind]: null }));
    setFeedback(null);
  }, []);

  const hitTestSlot = useCallback((clientX: number, clientY: number): SlotKind | null => {
    for (const kind of ["length", "trig", "angle"] as SlotKind[]) {
      const el = slotEls.current[kind];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      ) {
        return kind;
      }
    }
    return null;
  }, []);

  const onBlockPointerDown = useCallback(
    (e: React.PointerEvent, block: Block, fromSlot: SlotKind | null) => {
      if (phaseRef.current !== "playing" || sceneStatus !== "idle") return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      setDrag({
        block,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        fromSlot,
      });
      setSelectedBlock(block);
    },
    [sceneStatus],
  );

  const dragging = drag !== null;
  dragRef.current = drag;

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : null));
      setHoverSlot(hitTestSlot(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent) => {
      const current = dragRef.current;
      const target = hitTestSlot(e.clientX, e.clientY);
      setDrag(null);
      setHoverSlot(null);
      if (!current) return;

      const dx = Math.abs(e.clientX - current.startX);
      const dy = Math.abs(e.clientY - current.startY);
      const moved = dx >= 8 || dy >= 8;

      if (target && current.block.kind === target) {
        if (current.fromSlot && current.fromSlot !== target) {
          clearSlot(current.fromSlot);
        }
        placeBlock(current.block, target);
        return;
      }
      if (moved && !target && current.fromSlot) {
        clearSlot(current.fromSlot);
        setSelectedBlock(null);
        return;
      }
      if (!moved) {
        setSelectedBlock(current.block);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, hitTestSlot, placeBlock, clearSlot]);

  const onInventoryTap = useCallback(
    (block: Block) => {
      if (phase !== "playing" || sceneStatus !== "idle") return;
      if (selectedBlock?.id === block.id) {
        // Auto-place into matching empty slot
        const kind = block.kind;
        if (!slots[kind]) {
          placeBlock(block, kind);
        } else {
          setSelectedBlock(null);
        }
        return;
      }
      setSelectedBlock(block);
    },
    [phase, sceneStatus, selectedBlock, slots, placeBlock],
  );

  const onSlotDropClick = useCallback(
    (kind: SlotKind) => {
      if (!selectedBlock) return;
      if (selectedBlock.kind !== kind) {
        setFeedback(
          kind === "length"
            ? "길이 슬롯에는 숫자 블록을 넣어 주세요"
            : kind === "trig"
              ? "삼각비 슬롯에는 sin · cos · tan 을 넣어 주세요"
              : "각도 슬롯에는 각도 블록을 넣어 주세요",
        );
        return;
      }
      placeBlock(selectedBlock, kind);
    },
    [selectedBlock, placeBlock],
  );

  const confirm = useCallback(() => {
    if (!canConfirm) return;
    const correct = isExpressionCorrect(slots, stage);
    if (correct) {
      const gained = pointsForStage(stageWrong);
      const nextScore = applyScoreGain(score, gained);
      const nextCleared = cleared + 1;
      setScore(nextScore);
      setCleared(nextCleared);
      setFeedback(`다리를 이었어요! +${nextScore - score}점`);
      setSceneStatus("success");
      setPhase("animating");
    } else {
      const r = ratio ?? 0;
      const nextWrong = stageWrong + 1;
      setStageWrong(nextWrong);
      setTotalWrong((w) => w + 1);
      if (r < 1) {
        setFeedback("다리가 짧아요… 수식을 다시 조립해 보세요");
        setSceneStatus("wrong-short");
      } else {
        setFeedback("다리가 너무 길어요! 절벽을 뚫고 나갔어요");
        setSceneStatus("wrong-long");
      }
      setPhase("animating");
    }
  }, [
    canConfirm,
    slots,
    stage,
    stageWrong,
    score,
    cleared,
    ratio,
  ]);

  const scoreRef = useRef(score);
  scoreRef.current = score;
  const clearedRef = useRef(cleared);
  clearedRef.current = cleared;
  const totalWrongRef = useRef(totalWrong);
  totalWrongRef.current = totalWrong;

  const onSceneAnimCompleteStable = useCallback(
    (status: SceneStatus) => {
      if (status === "success") {
        if (stageIndex + 1 >= STAGE_COUNT) {
          endRun(scoreRef.current, clearedRef.current, totalWrongRef.current);
        } else {
          resetStageLocal(stageIndex + 1);
          setPhase("playing");
        }
        return;
      }
      if (status === "wrong-short" || status === "wrong-long") {
        setSceneStatus("falling");
        return;
      }
      if (status === "falling") {
        setSceneStatus("idle");
        setPhase("playing");
      }
    },
    [stageIndex, endRun, resetStageLocal],
  );

  return (
    <div className="space-y-4">
      {phase === "ready" ? (
        <section className="quest-card border-lavender/40 bg-gradient-to-br from-lavender/40 via-sky/20 to-gold/25 p-5 sm:p-7">
          <h1 className="font-display text-2xl text-wood sm:text-3xl">
            삼각비 다리 놓기
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-foreground/70 sm:text-base">
            끊어진 다리 길이{" "}
            <Latex latex="x" className="mx-0.5 font-bold text-wood" />를{" "}
            <Latex
              latex="(\text{길이})\times(\text{삼각비})(\text{각도})"
              className="mx-0.5"
            />{" "}
            블록으로 조립해 보세요. 계산기 없이,{" "}
            <strong className="text-wood">수식 그 자체</strong>로 변의 길이를
            표현하는 감각을 길러요.
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm font-semibold text-foreground/65">
            <li>스테이지 {STAGE_COUNT}개 · 만점 약 1000점</li>
            <li>블록을 드래그하거나 탭해서 슬롯에 넣어요</li>
            <li>
              <Latex latex="\sin\theta=\cos(90^\circ-\theta)" /> 처럼 동치인
              식도 정답이에요
            </li>
          </ul>
          <button
            type="button"
            onClick={startFresh}
            className="mt-6 rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream"
          >
            다리 놓기 시작
          </button>
        </section>
      ) : null}

      {phase === "ended" ? (
        <section
          className="quest-card border-lavender/40 bg-gradient-to-br from-lavender/45 via-sky/25 to-gold/30 p-5 text-center sm:p-7"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-3xl text-wood sm:text-4xl">
            {score}점
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            다리 {cleared}/{STAGE_COUNT}개 연결 · 오답 시도 {totalWrong}회
          </p>

          {isPending && !submitResult ? (
            <p className="mt-4 text-sm font-bold text-wood/70">점수 반영 중…</p>
          ) : null}

          {submitResult?.error ? (
            <p className="mt-4 text-sm font-bold text-[#a63a1a]">
              {submitResult.error}
            </p>
          ) : null}

          {submitResult && !submitResult.error ? (
            submitResult.recorded ? (
              <p className="mt-4 text-sm font-bold text-wood">
                {submitResult.message}
              </p>
            ) : (
              <p className="mt-4 rounded-2xl bg-wood/5 px-4 py-3 text-sm font-semibold text-foreground/65">
                연습 모드 · 점수는 반영되지 않아요
                <span className="mt-1 block text-xs font-medium text-foreground/50">
                  학급에 배정·활성화된 게임을 학생 로그인으로 플레이하면 XP와
                  랭킹이 쌓여요.
                </span>
              </p>
            )
          ) : null}

          {submitResult?.recorded ? (
            <div className="mt-6 text-left">
              <GameRankingBoard
                rows={ranking}
                scope={rankingScope}
                mode={rankingMode}
                onScopeChange={(scope) => loadRanking({ scope })}
                onModeChange={(mode) => loadRanking({ mode })}
                loading={isPending}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={startFresh}
            className="mt-6 rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream"
          >
            다시 하기
          </button>
        </section>
      ) : null}

      {phase === "playing" || phase === "animating" ? (
        <>
          <section className="quest-card overflow-hidden p-3 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-wood">
              <span className="rounded-xl bg-lavender/45 px-3 py-1">
                스테이지 {stageIndex + 1}/{STAGE_COUNT}
              </span>
              <span className="rounded-xl bg-gold/50 px-3 py-1">
                {score}점
              </span>
              {stageWrong > 0 ? (
                <span className="rounded-xl bg-[#e85d4c]/15 px-3 py-1 text-[#a63a1a]">
                  이번 다리 오답 {stageWrong}
                </span>
              ) : null}
            </div>

            <TrigBuilderScene
              stage={stage}
              ratio={ratio}
              status={sceneStatus}
              onAnimComplete={onSceneAnimCompleteStable}
            />

            <p className="mt-3 text-center text-sm font-semibold text-foreground/65">
              기준각 {stage.theta}° · 주어진 {sideLabelKo(stage.givenSide)}{" "}
              {stage.givenLength} · 구할 변은 {sideLabelKo(stage.unknownSide)}{" "}
              <Latex latex="x" />
            </p>
            <p className="mt-1 text-center text-xs font-medium text-wood/55">
              {stage.hint}
            </p>
          </section>

          <section className="quest-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span className="font-display text-xl text-wood">x =</span>
              <SlotWell
                kind="length"
                block={slots.length}
                highlight={hoverSlot === "length" || selectedBlock?.kind === "length"}
                onClear={() => clearSlot("length")}
                onDropClick={() => onSlotDropClick("length")}
                slotRef={(el) => {
                  slotEls.current.length = el;
                }}
              />
              <span className="text-lg font-black text-wood">×</span>
              <SlotWell
                kind="trig"
                block={slots.trig}
                highlight={hoverSlot === "trig" || selectedBlock?.kind === "trig"}
                onClear={() => clearSlot("trig")}
                onDropClick={() => onSlotDropClick("trig")}
                slotRef={(el) => {
                  slotEls.current.trig = el;
                }}
              />
              <span className="text-lg font-black text-wood">(</span>
              <SlotWell
                kind="angle"
                block={slots.angle}
                highlight={hoverSlot === "angle" || selectedBlock?.kind === "angle"}
                onClear={() => clearSlot("angle")}
                onDropClick={() => onSlotDropClick("angle")}
                slotRef={(el) => {
                  slotEls.current.angle = el;
                }}
              />
              <span className="text-lg font-black text-wood">)</span>
            </div>

            <div className="mt-3 flex justify-center">
              <div className="rounded-2xl bg-wood/5 px-4 py-2 text-base">
                <Latex latex={`x=${latex}`} />
              </div>
            </div>

            {feedback ? (
              <p
                className={[
                  "mt-3 rounded-2xl px-4 py-3 text-center text-sm font-bold",
                  sceneStatus === "success"
                    ? "bg-mint/40 text-wood"
                    : "bg-[#e85d4c]/15 text-[#a63a1a]",
                ].join(" ")}
                role="status"
              >
                {feedback}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={!canConfirm}
                onClick={confirm}
                className="rounded-xl bg-wood px-6 py-3 text-base font-bold text-cream disabled:opacity-40"
              >
                다리 놓기 확인
              </button>
              <button
                type="button"
                disabled={phase !== "playing" || sceneStatus !== "idle"}
                onClick={() => {
                  setSlots(emptySlots());
                  setSelectedBlock(null);
                  setFeedback(null);
                }}
                className="rounded-xl bg-wood/10 px-4 py-3 text-sm font-bold text-wood disabled:opacity-40"
              >
                슬롯 비우기
              </button>
            </div>
          </section>

          <section className="quest-card p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold text-wood">블록 인벤토리</h2>
            <p className="mb-3 text-xs font-semibold text-foreground/55">
              드래그해서 슬롯에 놓거나, 블록을 탭한 뒤 빈 슬롯을 탭하세요.
            </p>
            <div className="flex flex-wrap gap-2">
              {inventory.map((block) => {
                const placed = placedIds.has(block.id);
                return (
                  <BlockChip
                    key={block.id}
                    block={block}
                    selected={selectedBlock?.id === block.id}
                    dimmed={placed}
                    onPointerDown={(e) => {
                      if (placed) return;
                      onBlockPointerDown(e, block, null);
                    }}
                    onClick={() => {
                      if (placed) return;
                      onInventoryTap(block);
                    }}
                  />
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {drag ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-90"
          style={{ left: drag.x, top: drag.y }}
          aria-hidden
        >
          <BlockChip block={drag.block} selected />
        </div>
      ) : null}
    </div>
  );
}
