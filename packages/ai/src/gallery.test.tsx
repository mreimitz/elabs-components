import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Gallery, type GalleryImage } from "./gallery";

afterEach(cleanup);

function img(n: number, extra?: Partial<GalleryImage>): GalleryImage {
  return {
    src: `https://images.test/${n}.png`,
    alt: `Photo ${n}`,
    title: `Title ${n}`,
    ...extra,
  };
}

const list = (count: number): GalleryImage[] => Array.from({ length: count }, (_, i) => img(i + 1));

describe("Gallery — layout by image count", () => {
  it("renders an empty state for no images", () => {
    render(<Gallery images={[]} />);
    expect(screen.getByText(/no images/i)).toBeInTheDocument();
  });

  it("renders a single framed image with an always-on expand button (no grid)", () => {
    render(<Gallery images={[img(1)]} />);
    expect(screen.getByRole("button", { name: /expand image/i })).toBeInTheDocument();
    // The standalone image exposes its alt; grid thumbnails (decorative) would not.
    expect(screen.getByRole("img", { name: "Photo 1" })).toBeInTheDocument();
  });

  it("renders a grid of tile buttons for multiple images", () => {
    render(<Gallery images={list(3)} />);
    expect(screen.getAllByRole("button", { name: /^Title \d+$/ })).toHaveLength(3);
    // No standalone expand button in grid mode (tiles are the expand affordance).
    expect(screen.queryByRole("button", { name: /expand image/i })).not.toBeInTheDocument();
  });
});

describe("Gallery — '+N more' overflow math", () => {
  it("collapses the overflow into a '+N more' tile past maxVisible (default 5)", () => {
    render(<Gallery images={list(12)} />);
    expect(screen.getAllByRole("button", { name: /^Title \d+$/ })).toHaveLength(5);
    expect(screen.getByText(/\+7 more/)).toBeInTheDocument(); // 12 − 5
    expect(screen.getByRole("button", { name: /show all 12 images/i })).toBeInTheDocument();
  });

  it("shows every tile with no overflow at exactly maxVisible", () => {
    render(<Gallery images={list(5)} />);
    expect(screen.getAllByRole("button", { name: /^Title \d+$/ })).toHaveLength(5);
    expect(screen.queryByText(/more/i)).not.toBeInTheDocument();
  });

  it("honours a custom maxVisible", () => {
    render(<Gallery images={list(6)} maxVisible={3} />);
    expect(screen.getAllByRole("button", { name: /^Title \d+$/ })).toHaveLength(3);
    expect(screen.getByText(/\+3 more/)).toBeInTheDocument(); // 6 − 3
  });
});

describe("Gallery — lightbox modal", () => {
  it("opens an accessible dialog with the image's metadata on expand", async () => {
    const user = userEvent.setup();
    render(<Gallery images={[img(1, { description: "A scenic render." })]} />);

    await user.click(screen.getByRole("button", { name: /expand image/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName(); // DialogTitle always present (Radix a11y)
    expect(within(dialog).getByText("A scenic render.")).toBeInTheDocument();
  });

  it("opens the carousel (prev/next) from the '+N more' tile", async () => {
    const user = userEvent.setup();
    render(<Gallery images={list(12)} />);

    await user.click(screen.getByRole("button", { name: /show all 12 images/i }));

    const dialog = await screen.findByRole("dialog");
    // True per-slide sync is verified by the Storybook play test in a real
    // browser; Embla cannot measure layout in jsdom. Here we assert the carousel
    // navigation surface mounted and is a named landmark.
    expect(within(dialog).getByRole("region", { name: /image gallery/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /next slide/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /previous slide/i })).toBeInTheDocument();
  });

  it("shows 'No details' when the active image has no metadata", async () => {
    const user = userEvent.setup();
    render(<Gallery images={[{ src: "https://images.test/x.png", alt: "Just alt" }]} />);

    await user.click(screen.getByRole("button", { name: /expand image/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/no details/i)).toBeInTheDocument();
  });

  it("renders custom metadata via renderMeta", async () => {
    const user = userEvent.setup();
    render(<Gallery images={[img(7)]} renderMeta={(image) => <p>custom: {image.title}</p>} />);

    await user.click(screen.getByRole("button", { name: /expand image/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("custom: Title 7")).toBeInTheDocument();
  });
});

describe("Gallery — loading & partial sets (loading-states.md)", () => {
  it("renders a skeleton grid (not the empty state) while loading from empty", () => {
    render(<Gallery images={[]} loading expectedCount={4} />);
    // The persistent live region carries the "Loading images" announcement text.
    expect(screen.getByText(/loading images/i)).toBeInTheDocument();
    expect(screen.queryByText(/no images/i)).not.toBeInTheDocument();
  });

  it("fills the gap with skeleton tiles while a partial set arrives (no '+N more')", () => {
    render(<Gallery images={list(2)} expectedCount={5} />);
    // The arrived tiles render...
    expect(screen.getAllByRole("button", { name: /^Title \d+$/ })).toHaveLength(2);
    // ...and the overflow collapse does NOT kick in while the set is still arriving.
    expect(screen.queryByText(/more/i)).not.toBeInTheDocument();
  });

  it("returns to normal overflow once the expected set has fully arrived", () => {
    render(<Gallery images={list(6)} expectedCount={6} />);
    expect(screen.getAllByRole("button", { name: /^Title \d+$/ })).toHaveLength(5);
    expect(screen.getByText(/\+1 more/)).toBeInTheDocument();
  });

  it("shows a per-image skeleton until the image loads, then removes it", () => {
    const { container } = render(<Gallery images={[img(1)]} />);
    // jsdom never fires `load`, so the skeleton overlay is present initially.
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    fireEvent.load(screen.getByRole("img", { name: "Photo 1" }));
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });
});

describe("Gallery — download affordance", () => {
  it("exposes a labelled download button (present in the DOM at rest, revealed on hover)", () => {
    render(<Gallery images={[img(1)]} />);
    expect(screen.getByRole("button", { name: /download image/i })).toBeInTheDocument();
  });

  it("removes every download affordance when hideDownload is set", () => {
    render(<Gallery images={list(3)} hideDownload />);
    expect(screen.queryByRole("button", { name: /download image/i })).not.toBeInTheDocument();
  });
});
