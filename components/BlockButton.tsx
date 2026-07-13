import Link from "next/link";
import { type ReactNode } from "react";

type Variant = "sky" | "mint" | "peach" | "lavender" | "gold";

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  className?: string;
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit";
};

const variantClass: Record<Variant, string> = {
  sky: "block-btn-sky",
  mint: "block-btn-mint",
  peach: "block-btn-peach",
  lavender: "block-btn-lavender",
  gold: "block-btn-gold",
};

const sizeClass = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

export default function BlockButton({
  children,
  href,
  onClick,
  variant = "gold",
  className = "",
  size = "md",
  type = "button",
}: Props) {
  const classes = `block-btn ${variantClass[variant]} ${sizeClass[size]} font-display ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
