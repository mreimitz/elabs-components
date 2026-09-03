/**
 * @elabs-ai/components-ai — AI Elements ported onto the brand-ui design system.
 *
 * Components are presentational and render the Vercel AI SDK's `UIMessage`
 * data model; the consuming app still owns model calls (e.g. `useChat`).
 *
 * ATTRIBUTION. Vendored from AI Elements (https://github.com/vercel/ai-elements,
 * https://elements.ai-sdk.dev):
 *
 *   Copyright 2023 Vercel, Inc.
 *   Licensed under the Apache License, Version 2.0.
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * MODIFICATIONS: these files have been changed from the originals — rewired to
 * import primitives from `@elabs-ai/components-ui` and tokens from
 * `@elabs-ai/components-tokens`, re-tokenized, and extended with surfaces that do
 * not exist upstream. Stating that is an Apache-2.0 §4(b) obligation, not a
 * courtesy — this is the notice that discharges it for the whole package.
 *
 * See ATTRIBUTION.md and .claude/rules/attribution.md.
 */
export * from "./agent";
export * from "./agent-event";
export * from "./agent-timeline";
export * from "./artifact";
export * from "./asset-preview";
export * from "./attachments";
export * from "./audio-player";
export * from "./audio-visualizer";
export * from "./canvas";
export * from "./chain-of-thought";
export * from "./chat-greeting";
export * from "./checkpoint";
export * from "./code-block";
export * from "./commit";
export * from "./composer";
export * from "./confirmation";
export * from "./connection";
export * from "./context-panel";
export * from "./controls";
export * from "./conversation";
export * from "./diff-view";
export * from "./edge";
export * from "./environment-variables";
export * from "./file-tree";
export * from "./gallery";
export * from "./grouped-parts";
export * from "./image";
export * from "./inline-citation";
export * from "./jsx-preview";
// Mermaid loads on first diagram render, not in the entry chunk. `preloadMermaid`
// warms it early when a surface is known to render diagrams.
export { createLazyMermaidPlugin, lazyMermaid, preloadMermaid } from "./_lazy-mermaid";
export * from "./markdown-view";
export * from "./message";
export * from "./message-compare";
export * from "./message-edit";
export * from "./message-feedback";
export * from "./message-form";
export * from "./message-form-spec";
export * from "./message-table";
export * from "./message-table-spec";
export * from "./mic-selector";
export * from "./model-provider-logo";
export * from "./motion-config";
export * from "./node";
export * from "./open-in-chat";
export * from "./package-info";
export * from "./panel";
export * from "./part-groups";
export * from "./permission-mode-select";
export * from "./persona";
export * from "./plan";
export * from "./prompt-input";
export * from "./prompt-input-effort";
export * from "./prompt-input-mode";
export * from "./prompt-input-slash";
export * from "./queue";
export * from "./reasoning";
export * from "./sandbox";
export * from "./schema-display";
export * from "./selection-toolbar";
export * from "./session-header";
export * from "./session-status-bar";
export * from "./shimmer";
export * from "./snippet";
export * from "./sources";
export * from "./speech-input";
export * from "./stack-trace";
export * from "./suggestion";
export * from "./task";
export * from "./test-results";
export * from "./token-usage";
export * from "./tool";
export * from "./tool-result-card";
export * from "./toolbar";
export * from "./transcription";
export * from "./turn-status";
export * from "./use-audio-level";
export * from "./voice-selector";
export * from "./web-preview";

export * from "./chat-shell";
