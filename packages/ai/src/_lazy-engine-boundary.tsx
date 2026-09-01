"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export interface LazyEngineBoundaryProps {
  children: ReactNode;
  /**
   * Called once a wrapped `lazy()` import rejects (an optional peer that is
   * not installed, or any other load-time failure). Return what to render in
   * its place — the boundary owns no default visual, since the right
   * stand-in differs by surface (an orb placeholder for `Persona`, `null`
   * for an `AudioPlayer` sub-control).
   */
  renderMissing: (error: unknown) => ReactNode;
}

interface LazyEngineBoundaryState {
  // Wrapped in an object so `{ value: undefined }` (a boundary that caught
  // an error whose value happens to be `undefined`) is distinguishable from
  // "nothing caught yet" (`error: null`).
  error: { value: unknown } | null;
}

/**
 * Catches a `React.lazy()` load failure — an optional peer dependency that is
 * not installed (issue #33), or any other dynamic-import rejection — and
 * renders a caller-supplied fallback instead of unmounting the tree.
 *
 * `Suspense` alone does not do this: it only covers the PENDING state. A
 * REJECTED lazy import throws during render, and with no boundary above it
 * that throw propagates to the nearest ancestor boundary React DOES find —
 * by default, the whole app. This is the one place in `@elabs-ai/components-ai`
 * that needs a real render-phase error boundary; Mermaid and the interactive
 * terminal fail via an awaited promise instead (Streamdown's `errorComponent`
 * and a `.catch()` on the mount effect, respectively), which don't need one.
 */
export class LazyEngineBoundary extends Component<
  LazyEngineBoundaryProps,
  LazyEngineBoundaryState
> {
  override state: LazyEngineBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): LazyEngineBoundaryState {
    return { error: { value: error } };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      "[@elabs-ai/components-ai] a lazy engine failed to load:",
      error,
      info.componentStack,
    );
  }

  override render(): ReactNode {
    if (this.state.error) {
      return this.props.renderMissing(this.state.error.value);
    }
    return this.props.children;
  }
}
