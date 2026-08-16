/**
 * Ambient type for Vite's `?worker` import suffix. The Monaco worker entries
 * (`monaco-editor/esm/vs/.../*.worker?worker`) are resolved + bundled by Vite at
 * app build time; this declaration lets `tsc` typecheck the import in
 * `lib/monaco-environment.ts` without resolving the real module.
 */
declare module "*?worker" {
  const workerConstructor: { new (): Worker };
  export default workerConstructor;
}
