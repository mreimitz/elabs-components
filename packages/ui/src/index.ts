/**
 * @elabs-ai/components-ui — foundation + app UI components.
 *
 * Source-owned shadcn-style components built on Radix primitives and the
 * @elabs-ai/components-tokens semantic theme. Import the token stylesheet once at the app
 * root ("import \"@elabs-ai/components-tokens/styles.css\"") and wrap in <ThemeProvider>.
 *
 * NOTE: this barrel is generated to include every component folder. Some
 * components require their own peer libs (declared in package.json), e.g.
 * Drawer (vaul), Command (cmdk), Toast (sonner), Calendar (react-day-picker),
 * Carousel (embla-carousel-react), Resizable (react-resizable-panels),
 * Form (react-hook-form + zod), InputOTP (input-otp).
 */

// Utilities
export { cn } from "./lib/cn";
// The canonical mobile-breakpoint check (Sidebar / ContextPanel Sheet fallback
// pattern, research 09 §B.4) — exported so siblings don't fork a matchMedia hook.
export { useIsMobile } from "./lib/use-mobile";
// Browser file-download mechanics — one home for the Blob/URL → <a download> dance
// (shared by ConversationDownload, downloadCsv, and Gallery). SSR-guarded.
export { downloadBlob, downloadUrl } from "./lib/download";
// Clipboard write + transient "copied" flag — one implementation for the
// editor's copy button and `CopyableValue`, so the timing and the
// "no clipboard in this context" answer are defined once.
export {
  COPY_FEEDBACK_MS,
  useCopyToClipboard,
  type CopyToClipboard,
  type UseCopyToClipboardOptions,
} from "./lib/use-copy-to-clipboard";
// The shared file model (ADR 0024) — one input union + one coarse, CLOSED
// category, so `ai`, `viewer` and future surfaces stop each inventing their own.
// Fine-grained format matching belongs to the adapter manifests, not here.
export { type FileSource, type ResolvedFileSource, normalizeFileSource } from "./lib/file-source";
export {
  type FileCategory,
  type FileKind,
  extensionOf,
  mediaTypeFromName,
  resolveFileKind,
} from "./lib/file-kind";
export { FILE_CATEGORY_ICONS, fileIconFor } from "./lib/file-icon";
// How one PART of a document is addressed (ADR 0025). Lives here for the same
// reason `FileSource` does: the producer of a citation (`ai`) and its consumer
// (`viewer`) are Layer-2 siblings that may not import each other.
export {
  DOCUMENT_ADDRESS_KINDS,
  type DocumentAddress,
  type DocumentAddressKind,
  type DocumentRect,
  type NormalizedText,
  type QuoteAddress,
  type RangeAddress,
  type RectAddress,
  normalizeQuoteText,
  normalizeQuoteTextWithOffsets,
} from "./lib/document-address";
// Streamdown's in-markdown chrome, resolved through `t()` (#310). Shared here
// because both `ai` and `viewer` render Streamdown and may not import each other.
export {
  STREAMDOWN_TRANSLATION_KEYS,
  useStreamdownTranslations,
  type StreamdownTranslationKey,
  type StreamdownTranslationMap,
} from "./lib/streamdown-translations";

// Components
export * from "./components/accordion";
export * from "./components/advanced-group";
export * from "./components/app-sidebar";
export * from "./components/alert";
export * from "./components/alert-dialog";
export * from "./components/app-shell";
export * from "./components/aspect-ratio";
export * from "./components/attribution-panel";
export * from "./components/avatar";
export * from "./components/badge";
export * from "./components/bento-grid";
export * from "./components/bounded-number";
export * from "./components/breadcrumb";
export * from "./components/button";
export * from "./components/button-group";
export * from "./components/calendar";
export * from "./components/card";
export * from "./components/carousel";
export * from "./components/change-review";
export * from "./components/checkbox";
export * from "./components/collapsible";
export * from "./components/collapsible-panel";
export * from "./components/color-picker";
export * from "./components/combobox";
export * from "./components/command";
export * from "./components/confirm-dialog";
export * from "./components/context-menu";
export * from "./components/copyable-value";
export * from "./components/date-picker";
export * from "./components/date-range-picker";
export * from "./components/descriptions";
export * from "./components/dialog";
export * from "./components/drawer";
export * from "./components/dropdown-menu";
export * from "./components/empty-state";
export * from "./components/error-state";
export * from "./components/expand-dialog";
export * from "./components/field-row";
export * from "./components/file-upload";
export * from "./components/form";
export * from "./components/hover-card";
export * from "./components/icon-button";
export * from "./components/input";
export * from "./components/input-group";
export * from "./components/input-otp";
export * from "./components/kbd";
export * from "./components/key-value-editor";
export * from "./components/label";
export * from "./components/link-preview";
export * from "./components/list-editor";
export * from "./components/locale-provider";
export * from "./components/loading-state";
export * from "./components/match-highlight";
export * from "./components/mention-input";
export * from "./components/menubar";
export * from "./components/model-picker";
export * from "./components/metric-card";
export * from "./components/nav-main";
export * from "./components/nav-notifications";
export * from "./components/nav-user";
export * from "./components/navigation-menu";
export * from "./components/number-input";
export * from "./components/page-shell";
export * from "./components/pagination";
export * from "./components/popover";
export * from "./components/progress";
export * from "./components/radio-group";
export * from "./components/rating";
export * from "./components/resizable";
export * from "./components/reveal";
export * from "./components/scroll-area";
export * from "./components/section-header";
export * from "./components/segmented-field";
export * from "./components/select";
export * from "./components/separator";
export * from "./components/sheet";
export * from "./components/sidebar";
export * from "./components/skeleton";
export * from "./components/slider";
export * from "./components/slider-number";
export * from "./components/sonner";
export * from "./components/spinner";
export * from "./components/state-panel";
export * from "./components/status-badge";
export * from "./components/split-panel";
export * from "./components/switch";
export * from "./components/table";
export * from "./components/tabs";
export * from "./components/tag-input";
export * from "./components/team-switcher";
export * from "./components/textarea";
export * from "./components/theme-switcher";
export * from "./components/revision-timeline";
export * from "./components/timeline";
export * from "./components/toggle";
export * from "./components/toggle-group";
export * from "./components/toolbar";
export * from "./components/tooltip";
export * from "./components/top-nav";
export * from "./components/transfer";
export * from "./components/tree";
export * from "./components/tree-select";
export * from "./components/typography";
export * from "./components/view-toolbar";
export * from "./components/virtual-select";
export * from "./components/wizard";
