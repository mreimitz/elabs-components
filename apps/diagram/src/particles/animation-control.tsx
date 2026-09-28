import { IconButton } from "@elabs-ai/components-ui";
import { Pause, Play } from "lucide-react";
import { toggleParticles, useParticlePreference } from "./preference";
export function FlowAnimationControl() {
  const { paused, reduced } = useParticlePreference();
  const label = reduced
    ? "Flow animation off: reduced motion"
    : paused
      ? "Resume flow animation"
      : "Pause flow animation";
  return (
    <IconButton
      icon={paused || reduced ? <Play /> : <Pause />}
      label={label}
      variant="ghost"
      size="icon-sm"
      aria-disabled={reduced}
      onClick={() => {
        if (!reduced) toggleParticles();
      }}
      className="rounded-none border-t border-border aria-disabled:opacity-50"
    />
  );
}
