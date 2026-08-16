/** Ambient declaration so `tsc` accepts CSS side-effect imports (resolved by the
 * consuming bundler — Vite for apps/Storybook). */
declare module "*.css";
