import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@elabs-ai/components-ui";

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
    </main>
  );
}
