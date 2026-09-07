import type { LanguageModelUsage } from "ai";
import { DEFAULT_MESSAGES, LocaleProvider } from "@elabs-ai/components-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TokenUsage, TokenUsageCache, TokenUsageReasoning } from "./token-usage";

// `LanguageModelUsage`'s reasoning/cache figures live under nested detail
// objects (`outputTokenDetails.reasoningTokens`, `inputTokenDetails.cacheReadTokens`).
// ai@6 also carried deprecated flat top-level aliases (`reasoningTokens`,
// `cachedInputTokens`); ai@7 removed them. This mock deliberately omits the
// flat aliases so the test only passes if the components read the nested path.
const usage: LanguageModelUsage = {
  inputTokens: 1000,
  inputTokenDetails: {
    noCacheTokens: 600,
    cacheReadTokens: 400,
    cacheWriteTokens: 0,
  },
  outputTokens: 200,
  outputTokenDetails: {
    textTokens: 150,
    reasoningTokens: 50,
  },
  totalTokens: 1200,
};

describe("TokenUsage usage readouts (#30, ai@7 LanguageModelUsage shape)", () => {
  it("TokenUsageReasoning reads outputTokenDetails.reasoningTokens, not a flat field", () => {
    render(
      <TokenUsage maxTokens={8000} usage={usage} usedTokens={1200}>
        <TokenUsageReasoning />
      </TokenUsage>,
    );
    expect(screen.getByText("Reasoning")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("TokenUsageCache reads inputTokenDetails.cacheReadTokens, not a flat field", () => {
    render(
      <TokenUsage maxTokens={8000} usage={usage} usedTokens={1200}>
        <TokenUsageCache />
      </TokenUsage>,
    );
    expect(screen.getByText("Cache")).toBeInTheDocument();
    expect(screen.getByText("400")).toBeInTheDocument();
  });

  it("renders nothing when the nested detail objects report zero", () => {
    const zeroUsage: LanguageModelUsage = {
      ...usage,
      inputTokenDetails: { ...usage.inputTokenDetails, cacheReadTokens: 0 },
      outputTokenDetails: { ...usage.outputTokenDetails, reasoningTokens: 0 },
    };
    const { container } = render(
      <TokenUsage maxTokens={8000} usage={zeroUsage} usedTokens={1200}>
        <TokenUsageReasoning />
        <TokenUsageCache />
      </TokenUsage>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("TokenUsage locale keys (#141, ai.context.* renamed to ai.tokenUsage.*)", () => {
  it("the shipped dictionary defines no ai.context.* key", () => {
    const staleKeys = Object.keys(DEFAULT_MESSAGES).filter((key) => key.startsWith("ai.context."));
    expect(staleKeys).toEqual([]);
  });

  it("renders its labels from the ai.tokenUsage.* namespace, not a stale fallback", () => {
    render(
      <LocaleProvider
        messages={{
          "ai.tokenUsage.reasoning": "Custom reasoning label",
          "ai.tokenUsage.cache": "Custom cache label",
        }}
      >
        <TokenUsage maxTokens={8000} usage={usage} usedTokens={1200}>
          <TokenUsageReasoning />
          <TokenUsageCache />
        </TokenUsage>
      </LocaleProvider>,
    );
    // A component still reading the old `ai.context.*` namespace would ignore
    // this override and keep rendering the untranslated English default
    // ("Reasoning" / "Cache") instead.
    expect(screen.getByText("Custom reasoning label")).toBeInTheDocument();
    expect(screen.getByText("Custom cache label")).toBeInTheDocument();
    expect(screen.queryByText("Reasoning")).not.toBeInTheDocument();
    expect(screen.queryByText("Cache")).not.toBeInTheDocument();
  });
});
