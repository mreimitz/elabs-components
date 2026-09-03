"use client";

import { Button } from "@elabs-ai/components-ui";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@elabs-ai/components-ui";
import { Progress } from "@elabs-ai/components-ui";
import { useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { LanguageModelUsage } from "ai";
import type { ComponentProps } from "react";
import { createContext, useContext, useMemo } from "react";
import { getUsage } from "tokenlens";

const PERCENT_MAX = 100;
const ICON_RADIUS = 10;
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_STROKE_WIDTH = 2;

type ModelId = string;

interface TokenUsageSchema {
  usedTokens: number;
  maxTokens: number;
  usage?: LanguageModelUsage;
  modelId?: ModelId;
}

const TokenUsageContext = createContext<TokenUsageSchema | null>(null);

const useTokenUsageValue = () => {
  const context = useContext(TokenUsageContext);

  if (!context) {
    throw new Error("TokenUsage components must be used within TokenUsage");
  }

  return context;
};

export type TokenUsageProps = ComponentProps<typeof HoverCard> & TokenUsageSchema;

export const TokenUsage = ({
  usedTokens,
  maxTokens,
  usage,
  modelId,
  ...props
}: TokenUsageProps) => {
  const contextValue = useMemo(
    () => ({ maxTokens, modelId, usage, usedTokens }),
    [maxTokens, modelId, usage, usedTokens],
  );

  return (
    <TokenUsageContext.Provider value={contextValue}>
      <HoverCard closeDelay={0} openDelay={0} {...props} />
    </TokenUsageContext.Provider>
  );
};

const TokenUsageIcon = () => {
  const { t } = useLocale();
  const { usedTokens, maxTokens } = useTokenUsageValue();
  const circumference = 2 * Math.PI * ICON_RADIUS;
  const usedPercent = usedTokens / maxTokens;
  const dashOffset = circumference * (1 - usedPercent);

  return (
    <svg
      aria-label={t("ai.context.usage")}
      height="20"
      role="img"
      style={{ color: "currentcolor" }}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width="20"
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.25"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.7"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={ICON_STROKE_WIDTH}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
};

export type TokenUsageTriggerProps = ComponentProps<typeof Button>;

export const TokenUsageTrigger = ({ children, ...props }: TokenUsageTriggerProps) => {
  const { formatNumber } = useLocale();
  const { usedTokens, maxTokens } = useTokenUsageValue();
  const usedPercent = usedTokens / maxTokens;
  const renderedPercent = formatNumber(usedPercent, {
    maximumFractionDigits: 1,
    style: "percent",
  });

  return (
    <HoverCardTrigger asChild>
      {children ?? (
        <Button type="button" variant="ghost" {...props}>
          <span className="font-medium text-muted-foreground">{renderedPercent}</span>
          <TokenUsageIcon />
        </Button>
      )}
    </HoverCardTrigger>
  );
};

export type TokenUsageContentProps = ComponentProps<typeof HoverCardContent>;

export const TokenUsageContent = ({ className, ...props }: TokenUsageContentProps) => (
  <HoverCardContent className={cn("min-w-60 divide-y overflow-hidden p-0", className)} {...props} />
);

export type TokenUsageContentHeaderProps = ComponentProps<"div">;

export const TokenUsageContentHeader = ({
  children,
  className,
  ...props
}: TokenUsageContentHeaderProps) => {
  const { formatNumber } = useLocale();
  const { usedTokens, maxTokens } = useTokenUsageValue();
  const usedPercent = usedTokens / maxTokens;
  const displayPct = formatNumber(usedPercent, {
    maximumFractionDigits: 1,
    style: "percent",
  });
  const used = formatNumber(usedTokens, {
    notation: "compact",
  });
  const total = formatNumber(maxTokens, {
    notation: "compact",
  });

  return (
    <div className={cn("w-full space-y-2 p-3", className)} {...props}>
      {children ?? (
        <>
          <div className="flex items-center justify-between gap-3 text-xs">
            <p>{displayPct}</p>
            <p className="font-mono text-muted-foreground">
              {used} / {total}
            </p>
          </div>
          <div className="space-y-2">
            <Progress className="bg-muted" value={usedPercent * PERCENT_MAX} />
          </div>
        </>
      )}
    </div>
  );
};

export type TokenUsageContentBodyProps = ComponentProps<"div">;

export const TokenUsageContentBody = ({
  children,
  className,
  ...props
}: TokenUsageContentBodyProps) => (
  <div className={cn("w-full p-3", className)} {...props}>
    {children}
  </div>
);

export type TokenUsageContentFooterProps = ComponentProps<"div">;

export const TokenUsageContentFooter = ({
  children,
  className,
  ...props
}: TokenUsageContentFooterProps) => {
  const { formatNumber, t } = useLocale();
  const { modelId, usage } = useTokenUsageValue();
  const costUSD = modelId
    ? getUsage({
        modelId,
        usage: {
          input: usage?.inputTokens ?? 0,
          output: usage?.outputTokens ?? 0,
        },
      }).costUSD?.totalUSD
    : undefined;
  const totalCost = formatNumber(costUSD ?? 0, {
    currency: "USD",
    style: "currency",
  });

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 bg-secondary p-3 text-xs",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <span className="text-muted-foreground">{t("ai.context.totalCost")}</span>
          <span>{totalCost}</span>
        </>
      )}
    </div>
  );
};

const TokensWithCost = ({ tokens, costText }: { tokens?: number; costText?: string }) => {
  const { formatNumber } = useLocale();
  return (
    <span>
      {tokens === undefined ? "—" : formatNumber(tokens, { notation: "compact" })}
      {costText ? <span className="ms-2 text-muted-foreground">• {costText}</span> : null}
    </span>
  );
};

export type TokenUsageInputProps = ComponentProps<"div">;

export const TokenUsageInput = ({ className, children, ...props }: TokenUsageInputProps) => {
  const { formatNumber, t } = useLocale();
  const { usage, modelId } = useTokenUsageValue();
  const inputTokens = usage?.inputTokens ?? 0;

  if (children) {
    return children;
  }

  if (!inputTokens) {
    return null;
  }

  const inputCost = modelId
    ? getUsage({
        modelId,
        usage: { input: inputTokens, output: 0 },
      }).costUSD?.totalUSD
    : undefined;
  const inputCostText = formatNumber(inputCost ?? 0, {
    currency: "USD",
    style: "currency",
  });

  return (
    <div className={cn("flex items-center justify-between text-xs", className)} {...props}>
      <span className="text-muted-foreground">{t("ai.context.input")}</span>
      <TokensWithCost costText={inputCostText} tokens={inputTokens} />
    </div>
  );
};

export type TokenUsageOutputProps = ComponentProps<"div">;

export const TokenUsageOutput = ({ className, children, ...props }: TokenUsageOutputProps) => {
  const { formatNumber, t } = useLocale();
  const { usage, modelId } = useTokenUsageValue();
  const outputTokens = usage?.outputTokens ?? 0;

  if (children) {
    return children;
  }

  if (!outputTokens) {
    return null;
  }

  const outputCost = modelId
    ? getUsage({
        modelId,
        usage: { input: 0, output: outputTokens },
      }).costUSD?.totalUSD
    : undefined;
  const outputCostText = formatNumber(outputCost ?? 0, {
    currency: "USD",
    style: "currency",
  });

  return (
    <div className={cn("flex items-center justify-between text-xs", className)} {...props}>
      <span className="text-muted-foreground">{t("ai.context.output")}</span>
      <TokensWithCost costText={outputCostText} tokens={outputTokens} />
    </div>
  );
};

export type TokenUsageReasoningProps = ComponentProps<"div">;

export const TokenUsageReasoning = ({
  className,
  children,
  ...props
}: TokenUsageReasoningProps) => {
  const { formatNumber, t } = useLocale();
  const { usage, modelId } = useTokenUsageValue();
  // `reasoningTokens` moved under `outputTokenDetails` in ai@7 (the flat,
  // deprecated top-level alias from ai@6 was removed).
  const reasoningTokens = usage?.outputTokenDetails?.reasoningTokens ?? 0;

  if (children) {
    return children;
  }

  if (!reasoningTokens) {
    return null;
  }

  const reasoningCost = modelId
    ? getUsage({
        modelId,
        usage: { reasoningTokens },
      }).costUSD?.totalUSD
    : undefined;
  const reasoningCostText = formatNumber(reasoningCost ?? 0, {
    currency: "USD",
    style: "currency",
  });

  return (
    <div className={cn("flex items-center justify-between text-xs", className)} {...props}>
      <span className="text-muted-foreground">{t("ai.context.reasoning")}</span>
      <TokensWithCost costText={reasoningCostText} tokens={reasoningTokens} />
    </div>
  );
};

export type TokenUsageCacheProps = ComponentProps<"div">;

export const TokenUsageCache = ({ className, children, ...props }: TokenUsageCacheProps) => {
  const { formatNumber, t } = useLocale();
  const { usage, modelId } = useTokenUsageValue();
  // `cachedInputTokens` moved under `inputTokenDetails.cacheReadTokens` in
  // ai@7 (the flat, deprecated top-level alias from ai@6 was removed).
  const cacheTokens = usage?.inputTokenDetails?.cacheReadTokens ?? 0;

  if (children) {
    return children;
  }

  if (!cacheTokens) {
    return null;
  }

  const cacheCost = modelId
    ? getUsage({
        modelId,
        usage: { cacheReads: cacheTokens, input: 0, output: 0 },
      }).costUSD?.totalUSD
    : undefined;
  const cacheCostText = formatNumber(cacheCost ?? 0, {
    currency: "USD",
    style: "currency",
  });

  return (
    <div className={cn("flex items-center justify-between text-xs", className)} {...props}>
      <span className="text-muted-foreground">{t("ai.context.cache")}</span>
      <TokensWithCost costText={cacheCostText} tokens={cacheTokens} />
    </div>
  );
};
