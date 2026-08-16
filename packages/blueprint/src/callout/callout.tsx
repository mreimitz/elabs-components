import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";

export type CalloutDirection = "up" | "down" | "left" | "right";
export type CalloutLeader = "none" | "line" | "elbow";

export interface CalloutProps extends HTMLAttributes<HTMLDivElement> {
  /** The part index shown in the bubble. */
  number: number | string;
  /** Optional short caption beside the bubble. */
  label?: ReactNode;
  /** Leader line style. @default "line" */
  leader?: CalloutLeader;
  /** Leader length in px. @default 32 */
  leaderLength?: number;
  /** Which way the leader points (and the label sits). @default "right" */
  direction?: CalloutDirection;
}

/**
 * Numbered part-reference bubble with a leader line — the "(3) ——— label"
 * annotation that points from a number to a part of a drawing. The number is
 * real text (the accessible content); the leader line is decorative.
 */
export const Callout = forwardRef<HTMLDivElement, CalloutProps>(function Callout(
  { number, label, leader = "line", leaderLength = 32, direction = "right", className, ...props },
  ref,
) {
  const horizontal = direction === "left" || direction === "right";
  const reverse = direction === "left" || direction === "up";

  const bubble = (
    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-rule font-mono text-xs text-foreground">
      {number}
    </span>
  );

  const R = 6;
  const leaderEl =
    leader === "none" ? null : leader === "elbow" ? (
      horizontal ? (
        <svg
          width={leaderLength}
          height={20}
          className="stroke-rule"
          fill="none"
          aria-hidden
          focusable="false"
        >
          <path
            d={`M0 18 H${leaderLength - R} Q${leaderLength} 18 ${leaderLength} ${18 - R} V2`}
            strokeWidth={1}
            strokeLinecap="round"
          />
          <circle cx={leaderLength} cy={2} r={1.5} className="fill-rule stroke-none" />
        </svg>
      ) : (
        <svg
          width={20}
          height={leaderLength}
          className="stroke-rule"
          fill="none"
          aria-hidden
          focusable="false"
        >
          <path
            d={`M2 0 V${leaderLength - R} Q2 ${leaderLength} ${2 + R} ${leaderLength} H18`}
            strokeWidth={1}
            strokeLinecap="round"
          />
          <circle cx={18} cy={leaderLength} r={1.5} className="fill-rule stroke-none" />
        </svg>
      )
    ) : horizontal ? (
      <svg width={leaderLength} height={8} className="stroke-rule" aria-hidden focusable="false">
        <line x1={0} y1={4} x2={leaderLength} y2={4} strokeWidth={1} />
      </svg>
    ) : (
      <svg width={8} height={leaderLength} className="stroke-rule" aria-hidden focusable="false">
        <line x1={4} y1={0} x2={4} y2={leaderLength} strokeWidth={1} />
      </svg>
    );

  const labelEl = label ? (
    <span className="font-mono text-sm text-muted-foreground">{label}</span>
  ) : null;

  const order = reverse ? [labelEl, leaderEl, bubble] : [bubble, leaderEl, labelEl];

  return (
    <div
      ref={ref}
      data-slot="callout"
      className={cn(
        "inline-flex items-center gap-1.5",
        horizontal ? "flex-row" : "flex-col",
        className,
      )}
      {...props}
    >
      {order.map((el, i) => (
        <span key={i} className="contents">
          {el}
        </span>
      ))}
    </div>
  );
});
