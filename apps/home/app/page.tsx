import { SiteGround } from "../components/site-ground";
import { Hero } from "../components/hero/hero";
import { Tour } from "../components/tour/tour";
import { TOUR_TABS } from "../components/tour/tabs";
import { WorksWith } from "../components/agents/works-with";
import { RouteCards } from "../components/routes/route-cards";

// The page, section by section in movement order; each RM item appends its section under its
// own comment. RM-094's hero replaced the RM-091 placeholder card (its theme switch now lives
// in the hero) and the RM-092 depth-plane preview (the float plane is the real use).
export default function HomePage() {
  return (
    <main className="flex min-h-dvh w-full flex-col">
      {/* RM-092 */}
      <SiteGround />
      {/* RM-094 */}
      <Hero />
      {/* RM-096 */}
      <Tour meta={TOUR_TABS} />
      {/* RM-102 — mounts directly after the RM-099 agents section once that lands; the matrix
          is its own section (`id="works-with"`), install + route cards follow as movement 6. */}
      <WorksWith />
      <RouteCards />
    </main>
  );
}
