/**
 * `/opengraph-image?theme=<slug>` (RM-093, concept §6 "OG image ... 9 OG variants"). A Route
 * Handler rather than the `opengraph-image.tsx` metadata-file convention: that convention's
 * default export never sees the request's search params (only route `params`), and `?theme=`
 * is exactly the state RM-091 already makes shareable in the page URL — the OG image is meant
 * to carry the SAME state a visitor shared. `layout.tsx`'s static `openGraph.images` points at
 * this route with the site's default family; a sharer's own `?theme=` stays on the page URL,
 * not (yet) threaded into the OG tag itself — Twitter/Slack/etc. unfurl the canonical page's
 * meta tags, which cannot vary per visitor without a per-URL crawl target.
 */
import { ImageResponse } from "next/og";
import themes from "../../content/generated/themes.json";
import { shellCopy } from "../../content/copy";

export const runtime = "nodejs";

interface ThemeSwatch {
  mode: "light" | "dark";
  value: string;
  label: string;
  primary: string | null;
  background: string | null;
}
interface ThemeFamily {
  slug: string;
  displayName: string;
  isDefault: boolean;
  modes: ThemeSwatch[];
}

const FAMILIES = themes as ThemeFamily[];

/**
 * oklch → `rgb()` — duplicated (not imported) from `packages/tokens/src/color-contrast.ts`'s
 * `parseOklch`/`oklchToSrgb` (CSS Color 4 reference matrices): that module sits behind
 * `@elabs-ai/components-tokens`'s `exports` map, which does not publish it, and Satori (the
 * renderer behind `next/og`) does not parse `oklch()` itself — it needs a literal `rgb()`.
 * Promoting a public tokens export for one call site is out of this item's scope.
 */
function oklchToRgbString(input: string | null, fallback: string): string {
  const m = input?.trim().match(/^oklch\(\s*([^)]+)\)$/i);
  const body = m?.[1];
  if (!body) return fallback;
  const [l, c, h] = body.split("/")[0]!.trim().split(/\s+/).map(Number);
  if (![l, c, h].every(Number.isFinite)) return fallback;
  const hr = ((h as number) * Math.PI) / 180;
  const a = (c as number) * Math.cos(hr);
  const b = (c as number) * Math.sin(hr);
  const l_ = (l as number) + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = (l as number) - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = (l as number) - 0.0894841775 * a - 1.291485548 * b;
  const [lc, mc, sc] = [l_ * l_ * l_, m_ * m_ * m_, s_ * s_ * s_];
  const lin: [number, number, number] = [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ];
  const toSrgb = (x: number) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };
  const [r, g, b2] = lin.map(toSrgb);
  // This IS the token's colour, converted at request time from the oklch() data in
  // themes.json — Satori (next/og's renderer) has no CSSOM and cannot resolve var(--…).
  return `rgb(${r}, ${g}, ${b2})`; // home-tokens-exempt: literal pixel value, not an authored colour
}

function familyBySlug(slug: string | null): ThemeFamily {
  return FAMILIES.find((f) => f.slug === slug) ?? FAMILIES.find((f) => f.isDefault) ?? FAMILIES[0]!;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const family = familyBySlug(searchParams.get("theme"));
  const light = family.modes.find((m) => m.mode === "light") ?? family.modes[0]!;
  // Named CSS colours, not functional notation — never hit in practice (every shipped theme
  // resolves both tokens), kept nameable-only so this line needs no raw-colour exemption.
  const background = oklchToRgbString(light.background, "whitesmoke");
  const primary = oklchToRgbString(light.primary, "slategray");

  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px",
        backgroundColor: background,
        color: primary,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 700, display: "flex" }}>{shellCopy.wordmark}</div>
      <div style={{ fontSize: 30, maxWidth: "1000px", display: "flex", lineHeight: 1.4 }}>
        {shellCopy.titleDefault}
      </div>
      <div style={{ display: "flex", gap: "12px" }}>
        {FAMILIES.map((f) => {
          const swatch = f.modes.find((m) => m.mode === "light") ?? f.modes[0]!;
          return (
            <div
              key={f.slug}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "9999px",
                backgroundColor: oklchToRgbString(swatch.background, background),
                border: `3px solid ${oklchToRgbString(swatch.primary, primary)}`,
              }}
            />
          );
        })}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
