/**
 * Ambient declarations for the `monaco-editor` deep ESM paths used by
 * `monaco-theme-bridge.test.ts` to resolve syntax colours through Monaco's
 * REAL token-theme trie (#90) — the only way to prove the bridge's rules
 * actually beat the inherited `vs`/`vs-dark` base themes, since the bug this
 * locks is invisible to a check that only reads `buildBrandThemeData()`'s
 * returned array.
 *
 * `monaco-editor`'s package `exports` map (`"./*": "./*"`) makes these paths
 * resolvable at runtime/bundle time, but ships no `.d.ts` for anything below
 * the top-level `editor.main.d.ts` barrel — hence the shims. Typed only as
 * far as the test needs; internals (`ThemeTrieElementRule`'s private-by-
 * convention `_foreground`/`_background` fields) are read structurally
 * because that's the real shape `tokenization.js` constructs at runtime (see
 * `ThemeTrieElementRule` in that file for the source of truth).
 */
declare module "monaco-editor/esm/vs/editor/common/languages/supports/tokenization.js" {
  import type * as Monaco from "monaco-editor";

  /** Mirrors `ThemeTrieElementRule` — the resolved node `_match` returns. */
  interface ResolvedThemeTrieRule {
    readonly _fontStyle: number;
    readonly _foreground: number;
    readonly _background: number;
    readonly metadata: number;
  }

  /** Mirrors `Color` (`base/common/color.js`) — enough to read RGB channels. */
  interface MonacoColor {
    readonly rgba: { r: number; g: number; b: number; a: number };
    toString(): string;
  }

  export class TokenTheme {
    static createFromRawTokenTheme(
      source: Monaco.editor.ITokenThemeRule[],
      customTokenColors: string[],
    ): TokenTheme;
    /** Internal (underscore) but exercised directly — see file header. */
    _match(token: string): ResolvedThemeTrieRule;
    getColorMap(): MonacoColor[];
  }
}

declare module "monaco-editor/esm/vs/editor/standalone/common/themes.js" {
  import type * as Monaco from "monaco-editor";

  interface BuiltinRawTheme {
    readonly base: string;
    readonly inherit: boolean;
    readonly rules: Monaco.editor.ITokenThemeRule[];
    readonly colors: Record<string, string>;
  }

  export const vs: BuiltinRawTheme;
  export const vs_dark: BuiltinRawTheme;
  export const hc_black: BuiltinRawTheme;
  export const hc_light: BuiltinRawTheme;
}
