"use client";
/**
 * The hero's control row (RM-094): the full-size theme-family switch with its mode toggle,
 * bound to the site theme state, and the dials popover — density, decoration and motion, bound
 * to the tokens' ThemeProvider dials.
 */
import { useId } from "react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedField,
  Slider,
  ThemeFamilySwitch,
} from "@elabs-ai/components-ui";
import {
  useDecoration,
  useDensity,
  useMotionPreference,
  type DecorationLevel,
  type DensityMode,
  type MotionPreference,
} from "@elabs-ai/components-tokens";
import { useSiteTheme } from "../../lib/theme-state";
import { heroCopy } from "../../content/copy";

const dials = heroCopy.dials;

const DENSITY_OPTIONS = [
  { value: "compact", label: dials.densityOptions.compact },
  { value: "comfortable", label: dials.densityOptions.comfortable },
  { value: "spacious", label: dials.densityOptions.spacious },
];

const MOTION_OPTIONS = [
  { value: "system", label: dials.motionOptions.system },
  { value: "reduced", label: dials.motionOptions.reduced },
  { value: "full", label: dials.motionOptions.full },
];

export function HeroThemeSwitch() {
  const { family, mode, setFamily, setMode, families } = useSiteTheme();
  return (
    <ThemeFamilySwitch
      size="lg"
      aria-label={heroCopy.switchLabel}
      families={families.map((f) => ({ id: f.id, label: f.label, swatch: f.swatches[mode] }))}
      value={family}
      onChange={setFamily}
      mode={mode}
      onModeChange={setMode}
    />
  );
}

export function HeroDials() {
  const decorationId = useId();
  const { density, setDensity } = useDensity();
  const { effectiveDecoration, setDecoration } = useDecoration();
  const { motionPreference, setMotionPreference } = useMotionPreference();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {dials.trigger}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-4">
        <span className="text-subtitle font-semibold">{dials.title}</span>
        <SegmentedField
          label={dials.density}
          size="sm"
          value={density}
          onValueChange={(v) => setDensity(v as DensityMode)}
          options={DENSITY_OPTIONS}
        />
        <div className="flex flex-col gap-2">
          <span id={decorationId} className="text-meta font-medium">
            {dials.decoration}
          </span>
          <Slider
            aria-labelledby={decorationId}
            min={0}
            max={10}
            step={1}
            value={[effectiveDecoration]}
            onValueChange={([v]) => setDecoration((v ?? 0) as DecorationLevel)}
          />
        </div>
        <SegmentedField
          label={dials.motion}
          size="sm"
          value={motionPreference}
          onValueChange={(v) => setMotionPreference(v as MotionPreference)}
          options={MOTION_OPTIONS}
        />
      </PopoverContent>
    </Popover>
  );
}
