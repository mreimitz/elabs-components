/**
 * Pure formatters behind `TokenSpotlight`'s chip values (#585). A chip shows a person what a token
 * resolves to, so a colour always reads as a rounded `oklch(L C H)` — whatever colour space the
 * CSS build or the browser serialised it in (`lab()`, `rgb()`, `color(srgb …)`, …) — and a length
 * reads as resolved px, never a raw `calc()`. DOM-free: the component feeds these the strings it
 * reads from `getComputedStyle`.
 *
 * Conversion math: CSS Color 4 §"Sample code for color conversions" (matrices and the Lab/OKLab
 * definitions are the spec's own, public domain).
 */

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

const mul = (m: Mat3, [a, b, c]: Vec3): Vec3 => [
  m[0][0] * a + m[0][1] * b + m[0][2] * c,
  m[1][0] * a + m[1][1] * b + m[1][2] * c,
  m[2][0] * a + m[2][1] * b + m[2][2] * c,
];

const LINEAR_SRGB_TO_XYZ_D65: Mat3 = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];
const LINEAR_P3_TO_XYZ_D65: Mat3 = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
];
/** Bradford chromatic adaptation, D50 → D65. */
const XYZ_D50_TO_D65: Mat3 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const XYZ_D65_TO_LMS: Mat3 = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const LMS_CBRT_TO_OKLAB: Mat3 = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.42859224204858, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const D50_WHITE: Vec3 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

const srgbToLinear = (c: number) => {
  const abs = Math.abs(c);
  return abs <= 0.04045 ? c / 12.92 : Math.sign(c) * ((abs + 0.055) / 1.055) ** 2.4;
};

function labToXyzD50([l, a, b]: Vec3): Vec3 {
  const kappa = 24389 / 27;
  const epsilon = 216 / 24389;
  const f1 = (l + 16) / 116;
  const f0 = a / 500 + f1;
  const f2 = f1 - b / 200;
  const x = f0 ** 3 > epsilon ? f0 ** 3 : (116 * f0 - 16) / kappa;
  const y = l > kappa * epsilon ? f1 ** 3 : l / kappa;
  const z = f2 ** 3 > epsilon ? f2 ** 3 : (116 * f2 - 16) / kappa;
  return [x * D50_WHITE[0], y * D50_WHITE[1], z * D50_WHITE[2]];
}

function xyzD65ToOklab(xyz: Vec3): Vec3 {
  const [l, m, s] = mul(XYZ_D65_TO_LMS, xyz);
  return mul(LMS_CBRT_TO_OKLAB, [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)]);
}

const polarToRect = (c: number, hDeg: number): [number, number] => [
  c * Math.cos((hDeg * Math.PI) / 180),
  c * Math.sin((hDeg * Math.PI) / 180),
];

/** One channel token: a number, a percentage, an angle, or `none` (→ 0). `null` when unreadable. */
function readChannel(raw: string, percentScale: number): number | null {
  if (raw === "none") return 0;
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|grad|turn)?$/i.exec(raw);
  if (!match) return null;
  const n = Number(match[1]);
  switch (match[2]?.toLowerCase()) {
    case "%":
      return (n / 100) * percentScale;
    case "rad":
      return (n * 180) / Math.PI;
    case "grad":
      return n * 0.9;
    case "turn":
      return n * 360;
    default:
      return n;
  }
}

interface ParsedColor {
  /** OKLab. */
  lab: Vec3;
  alpha: number;
}

/** Parses the colour serialisations browsers and CSS builds emit into OKLab. `null` if unknown. */
function parseCssColor(value: string): ParsedColor | null {
  const fn = /^([a-z-]+)\(\s*(.*?)\s*\)$/i.exec(value.trim());
  if (!fn?.[1] || fn[2] === undefined) return null;
  const name = fn[1].toLowerCase();
  const [channelPart = "", alphaPart] = fn[2].split("/").map((part) => part.trim());
  let args = channelPart.split(/[\s,]+/).filter(Boolean);
  let alphaRaw = alphaPart;
  let space = "";
  if (name === "color") {
    space = (args.shift() ?? "").toLowerCase();
  }
  if ((name === "rgb" || name === "rgba") && args.length === 4 && alphaRaw === undefined) {
    alphaRaw = args[3]; // legacy `rgba(r, g, b, a)`
    args = args.slice(0, 3);
  }
  if (args.length !== 3) return null;
  const alpha = alphaRaw === undefined ? 1 : readChannel(alphaRaw, 1);
  if (alpha === null) return null;

  const read = (scales: Vec3): Vec3 | null => {
    const out = args.map((arg, i) => readChannel(arg, scales[i] ?? 1));
    return out.every((n): n is number => n !== null) ? (out as Vec3) : null;
  };

  let lab: Vec3 | null = null;
  switch (name) {
    case "rgb":
    case "rgba": {
      const rgb = read([255, 255, 255]);
      if (rgb) {
        const linear = rgb.map((c) => srgbToLinear(c / 255)) as Vec3;
        lab = xyzD65ToOklab(mul(LINEAR_SRGB_TO_XYZ_D65, linear));
      }
      break;
    }
    case "lab": {
      const cie = read([100, 125, 125]);
      if (cie) lab = xyzD65ToOklab(mul(XYZ_D50_TO_D65, labToXyzD50(cie)));
      break;
    }
    case "lch": {
      const lch = read([100, 150, 1]);
      if (lch) {
        const [a, b] = polarToRect(lch[1], lch[2]);
        lab = xyzD65ToOklab(mul(XYZ_D50_TO_D65, labToXyzD50([lch[0], a, b])));
      }
      break;
    }
    case "oklab":
      lab = read([1, 0.4, 0.4]);
      break;
    case "oklch": {
      const lch = read([1, 0.4, 1]);
      if (lch) lab = [lch[0], ...polarToRect(lch[1], lch[2])];
      break;
    }
    case "color": {
      const c = read([1, 1, 1]);
      if (!c) break;
      if (space === "srgb")
        lab = xyzD65ToOklab(mul(LINEAR_SRGB_TO_XYZ_D65, c.map(srgbToLinear) as Vec3));
      else if (space === "srgb-linear") lab = xyzD65ToOklab(mul(LINEAR_SRGB_TO_XYZ_D65, c));
      else if (space === "display-p3")
        lab = xyzD65ToOklab(mul(LINEAR_P3_TO_XYZ_D65, c.map(srgbToLinear) as Vec3));
      else if (space === "xyz" || space === "xyz-d65") lab = xyzD65ToOklab(c);
      else if (space === "xyz-d50") lab = xyzD65ToOklab(mul(XYZ_D50_TO_D65, c));
      break;
    }
  }
  return lab ? { lab, alpha } : null;
}

/** Rounds to `digits` decimals and drops trailing zeros (`0.250` → `0.25`, `-0` → `0`). */
function trimNumber(n: number, digits: number): string {
  const rounded = Number(n.toFixed(digits));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/**
 * Re-encodes any CSS colour string this module can parse as a rounded `oklch(L C H)` — L and C to
 * 3 decimals, H to whole degrees (`0` for an achromatic colour), ` / A` only when translucent.
 * `null` when the string is not a colour it understands (the caller falls back to the raw value).
 *
 * @example formatColorAsOklch("lab(98.2553% -.143647 -.74234)") // "oklch(0.985 0.002 257)"
 */
export function formatColorAsOklch(value: string): string | null {
  const parsed = parseCssColor(value);
  if (!parsed) return null;
  const [l, a, b] = parsed.lab;
  const chroma = Math.hypot(a, b);
  const lightness = trimNumber(Math.min(Math.max(l, 0), 1), 3);
  const c = trimNumber(chroma, 3);
  const hue =
    c === "0" ? "0" : trimNumber(((((Math.atan2(b, a) * 180) / Math.PI) % 360) + 360) % 360, 0);
  const alpha = parsed.alpha < 1 ? ` / ${trimNumber(Math.max(parsed.alpha, 0), 2)}` : "";
  return `oklch(${lightness} ${c} ${hue === "360" ? "0" : hue}${alpha})`;
}

/** A resolved px length (`"4px"`, `"4.5px"`) rounded to 2 decimals. `null` for anything else. */
export function formatLengthAsPx(value: string): string | null {
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)px$/i.exec(value.trim());
  return match ? `${trimNumber(Number(match[1]), 2)}px` : null;
}
