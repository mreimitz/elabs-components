/**
 * Persona artwork sources — a plain data module shared by `persona.tsx` (the
 * public shell) and `_persona-rive.tsx` (the lazily-loaded Rive half), so
 * neither has to import the other.
 */

export type PersonaState = "idle" | "listening" | "thinking" | "speaking" | "asleep";

export interface PersonaSource {
  /** The artwork exposes a colour view-model that follows the light/dark theme. */
  dynamicColor: boolean;
  /** The artwork has a Rive view-model (vs. a plain state machine). */
  hasModel: boolean;
  /** Absolute URL of the `.riv` artwork. */
  source: string;
}

/**
 * Where the shipped `.riv` artwork is fetched from.
 *
 * ⚠️ These are REMOTE origins fetched at runtime by the Rive runtime — a
 * deployment with a restrictive `connect-src` blocks them, and the component
 * falls back to a token-driven orb. Self-host the six files and pass
 * `<Persona src={…}>` to point at your own copies. See `docs/CSP-AND-NETWORK.md`.
 */
export const PERSONA_SOURCES = {
  command: {
    dynamicColor: true,
    hasModel: true,
    source: "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/command-2.0.riv",
  },
  glint: {
    dynamicColor: true,
    hasModel: true,
    source: "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/glint-2.0.riv",
  },
  halo: {
    dynamicColor: true,
    hasModel: true,
    source: "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/halo-2.0.riv",
  },
  mana: {
    dynamicColor: false,
    hasModel: true,
    source: "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/mana-2.0.riv",
  },
  obsidian: {
    dynamicColor: true,
    hasModel: true,
    source: "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/obsidian-2.0.riv",
  },
  opal: {
    dynamicColor: false,
    hasModel: false,
    source: "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/orb-1.2.riv",
  },
} as const satisfies Record<string, PersonaSource>;

export type PersonaVariant = keyof typeof PERSONA_SOURCES;
