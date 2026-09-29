import type { FlowKind } from "../edges/data-flow-edge-data";
export type ParticleSprite = "dot" | "arrow" | "user" | "tick" | "dash";
export interface ParticleProfile {
  cadence: "continuous" | "hourly" | "batch" | "demand";
  spawnEveryMs: number;
  burst: number;
  size: number;
  speed: number;
  sprite: ParticleSprite;
  opacity: number;
}
const SPRITES: Record<FlowKind, ParticleSprite> = {
  data: "dot",
  request: "arrow",
  access: "user",
  control: "tick",
  network: "dash",
};
/** Schedules remain descriptive strings. Recognized prefixes supply cadence; unknown/missing
 * schedules use a modest steady stream. Density is bounded, with no new authored axis. */
export function particleProfile(kind: FlowKind = "data", schedule = ""): ParticleProfile {
  const value = schedule.trim().toLowerCase();
  const cadence = /^(on[- ]demand|query time|when requested)/.test(value)
    ? "demand"
    : /^(nightly|daily|batch)/.test(value)
      ? "batch"
      : /^(hourly|every hour)/.test(value)
        ? "hourly"
        : "continuous";
  const realtime = /^(real[- ]time|continuous|stream)/.test(value);
  return {
    cadence,
    spawnEveryMs: cadence === "batch" ? 6000 : cadence === "hourly" ? 2000 : realtime ? 600 : 1200,
    burst: cadence === "hourly" ? 3 : 1,
    size: cadence === "batch" ? 5 : kind === "access" ? 4 : 3,
    speed: 44,
    sprite: SPRITES[kind],
    opacity: kind === "network" ? 0.55 : 0.9,
  };
}
export const MAX_PARTICLES_PER_EDGE = 12;
export const MAX_PARTICLE_EDGES = 240;
/** A bounded analytical clock: no particle objects are allocated during animation. */
export function particlePhase(
  time: number,
  ordinal: number,
  duration: number,
  profile: ParticleProfile,
  both = false,
): number | null {
  if (!(duration > 0)) return null;
  // Thin emissions on long/zoomed paths instead of recycling a pulse before it arrives.
  // Both directions share the budget; a delayed burst member must finish too.
  const groups = Math.floor(MAX_PARTICLES_PER_EDGE / (both ? 2 : 1) / profile.burst);
  const interval = Math.max(profile.spawnEveryMs, (duration + (profile.burst - 1) * 130) / groups);
  const age =
    (time % interval) +
    Math.floor(ordinal / profile.burst) * interval -
    (ordinal % profile.burst) * 130;
  return age >= 0 && age <= duration ? age / duration : null;
}
/** Both directions share an emission age, including a single short-path batch pulse. */
export function particleSlots(duration: number, profile: ParticleProfile, both: boolean): number {
  const directions = both ? 2 : 1;
  return Math.min(
    MAX_PARTICLES_PER_EDGE,
    Math.max(1, Math.ceil((duration + (profile.burst - 1) * 130) / profile.spawnEveryMs)) *
      profile.burst *
      directions,
  );
}
