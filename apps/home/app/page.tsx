import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@elabs-ai/components-ui";
import { ParallaxPlane, RevealOnEnter } from "@elabs-ai/components-marketing";
import { SiteGround } from "../components/site-ground";

// RM-092: a preview of the three depth planes until the real sections (RM-094) replace it.
const PLANES = [
  { plane: "ground", title: "Ground", description: "Scrolls at 0.15× the page." },
  { plane: "content", title: "Content", description: "Scrolls with the page." },
  { plane: "float", title: "Float", description: "Scrolls at 1.2× the page." },
] as const;

// Placeholder: proves the pipeline (workspace source → Tailwind @source → tokens → theme) end to
// end. The real sections replace it.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>brand-ui</CardTitle>
          <CardDescription>
            The website is being built. The components and their documentation are in Storybook.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="/storybook/">Open Storybook</a>
          </Button>
        </CardContent>
      </Card>
      {/* RM-092 */}
      <SiteGround />
      <section aria-label="Depth planes" className="flex min-h-screen flex-col justify-end">
        <RevealOnEnter as="ul" stagger className="grid gap-6 sm:grid-cols-3">
          {PLANES.map(({ plane, title, description }) => (
            <li key={plane}>
              <ParallaxPlane plane={plane}>
                <Card>
                  <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              </ParallaxPlane>
            </li>
          ))}
        </RevealOnEnter>
      </section>
      <div aria-hidden="true" className="min-h-screen" />
    </main>
  );
}
