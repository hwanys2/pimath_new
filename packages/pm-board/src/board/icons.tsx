import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps): IconProps {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props,
  };
}

export const CursorIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 3l14 8-6.5 1.5L9 19 5 3z" />
  </svg>
);

export const PenIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M17 3l4 4L8 20l-5 1 1-5L17 3z" />
  </svg>
);

export const HighlighterIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 11l6-6 4 4-6 6H9v-4z" />
    <path d="M9 11l-3 3v3h4l2-2" />
    <path d="M3 21h18" opacity={0.4} />
  </svg>
);

export const EraserIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 20l-4-4a2 2 0 010-3l9-9a2 2 0 013 0l6 6a2 2 0 010 3l-7 7H7z" />
    <path d="M6 11l7 7" />
  </svg>
);

export const LineIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20L20 4" />
  </svg>
);

export const SegmentLineIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="19" cy="5" r="1.5" fill="currentColor" stroke="none" />
    <path d="M6 18L18 6" />
  </svg>
);

export const RayLineIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
    <path d="M6 18L20 4" />
    <path d="M14 4h6v6" />
  </svg>
);

export const InfiniteLineIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 12h18" />
    <path d="M3 8l-2 4 2 4" />
    <path d="M21 8l2 4-2 4" />
  </svg>
);

export const ArrowIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20L20 4" />
    <path d="M12 4h8v8" />
  </svg>
);

export const RectIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="6" width="16" height="12" rx="1" />
  </svg>
);

export const EllipseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="12" rx="8" ry="6" />
  </svg>
);

/** Construction point — hollow ring + center (not stroke width). */
export const PointToolIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
  </svg>
);

/** Pen stroke thickness — three lines, not a dot. */
export const StrokeWidthIcon = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.2}>
    <path d="M4 7h16" strokeWidth={1.4} />
    <path d="M4 12h16" strokeWidth={2.4} />
    <path d="M4 17h16" strokeWidth={3.6} />
  </svg>
);

export const UndoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 016 6v1" />
  </svg>
);

export const RedoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H10a6 6 0 00-6 6v1" />
  </svg>
);

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const WidgetsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);

export const BackgroundIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <path d="M3 14l5-5 4 4 3-3 6 6" />
    <path d="M9 21h6" />
  </svg>
);

export const RulerIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2" y="9" width="20" height="6" rx="1" transform="rotate(-20 12 12)" />
    <path d="M7 13.5l1 2M11 12l1 2M15 10.5l1 2" transform="rotate(-20 12 12)" />
  </svg>
);

export const ProtractorIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 16a8 8 0 0116 0z" />
    <path d="M12 16v-4M8 15l1-2M16 15l-1-2" />
  </svg>
);

export const CompassIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="5" r="2.2" />
    <path d="M12 7L6 20M12 7l6 13" />
    <path d="M8.5 14h7" />
    <circle cx="6" cy="20" r="1.4" />
    <path d="M16.2 18.5l2.3 3.2M19.5 18.2l-1.5 1.2" />
  </svg>
);

export const MathFormulaIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 7h4l2 6 2-6h4" />
    <path d="M5 17h14" />
    <path d="M9 14h6" strokeWidth={1.5} />
  </svg>
);

export const FullscreenIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);

export const ExitFullscreenIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </svg>
);

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v10h12V10" />
  </svg>
);

export const TimerIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 13V8M9 2h6" />
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

export const PickerIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3.5 20a5.5 5.5 0 0111 0" />
    <path d="M16 5l1.2 2.4L20 8l-2.8.6L16 11l-1.2-2.4L12 8l2.8-.6L16 5z" strokeWidth={1.5} />
  </svg>
);

export const DiceIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="15" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
    <circle cx="9" cy="15" r="1" fill="currentColor" />
  </svg>
);

export const RandomIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7h4l10 10h4M17 3l4 4-4 4M3 17h4l2-2M13 9l4-4M17 21l4-4-4-4" />
  </svg>
);

export const TrafficIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="8" y="3" width="8" height="18" rx="3" />
    <circle cx="12" cy="7" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="17" r="1.4" fill="currentColor" />
  </svg>
);

export const NoiseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M11 5L6 9H3v6h3l5 4V5z" />
    <path d="M15 9a4 4 0 010 6M18 6.5a8 8 0 010 11" />
  </svg>
);

export const QrIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="6" height="6" />
    <rect x="14" y="4" width="6" height="6" />
    <rect x="4" y="14" width="6" height="6" />
    <path d="M14 14h3v3h-3zM20 14v2M17 20h3M14 19v1" />
  </svg>
);

export const NoteIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 4h14v11l-5 5H5V4z" />
    <path d="M14 20v-5h5" />
  </svg>
);

export const GraphIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 4v16h16" />
    <path d="M6 16c3-8 6 2 8-4s3-4 5-6" />
  </svg>
);

export const ImageIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
    <path d="M21 17l-5.5-5.5a1.5 1.5 0 00-2.1 0L5 19" />
  </svg>
);

export const CalculatorIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8 7h8" />
    <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" strokeWidth={2.6} />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MinusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);

export const RotateIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 8a8 8 0 10.5 6" />
    <path d="M20 3v5h-5" />
  </svg>
);
