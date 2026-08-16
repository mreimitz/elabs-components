import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { Image, type ImageProps } from "./image";

const RED_DOT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

const BASE_PROPS: Pick<ImageProps, "base64" | "mediaType" | "uint8Array"> = {
  base64: RED_DOT,
  mediaType: "image/png",
  uint8Array: new Uint8Array(),
};

describe("Image", () => {
  it("renders the img with the base64 data URI, alt, width and height", () => {
    const { container } = render(
      <Image {...BASE_PROPS} alt="A red square" width={64} height={64} />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(`data:image/png;base64,${RED_DOT}`);
    expect(img?.getAttribute("alt")).toBe("A red square");
    expect(img?.getAttribute("width")).toBe("64");
    expect(img?.getAttribute("height")).toBe("64");
  });

  it("defaults alt to empty (decorative) rather than omitting it", () => {
    const { container } = render(<Image {...BASE_PROPS} />);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("forwards a ref to the underlying <img>", () => {
    const ref = createRef<HTMLImageElement>();
    render(<Image ref={ref} {...BASE_PROPS} />);
    expect(ref.current).toBeInstanceOf(HTMLImageElement);
  });
});

describe("Image showSkeleton (#269, loading-states.md)", () => {
  it("shows a Skeleton (decorative + a live region) until onLoad fires, when width+height are given", () => {
    const { container } = render(<Image {...BASE_PROPS} alt="" width={64} height={64} />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    // Exactly one live region for the region.
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);

    const img = container.querySelector("img")!;
    fireEvent.load(img);
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("defaults to no skeleton (and no live region) when width/height are not given — nothing to reserve", () => {
    const { container } = render(<Image {...BASE_PROPS} alt="" />);
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("skips the skeleton entirely when showSkeleton is explicitly false, even with width+height", () => {
    const { container } = render(
      <Image {...BASE_PROPS} alt="" width={64} height={64} showSkeleton={false} />,
    );
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("shows the skeleton when explicitly enabled even without width/height", () => {
    const { container } = render(<Image {...BASE_PROPS} alt="" showSkeleton />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("does not wrap the <img> in a sizing span when no skeleton is shown, so className keeps resolving against the real parent", () => {
    const { container } = render(<Image {...BASE_PROPS} alt="" className="w-full" />);
    expect(container.firstElementChild?.tagName).toBe("IMG");
  });

  it("calls the consumer's onLoad in addition to clearing the skeleton", () => {
    const onLoad = vi.fn();
    const { container } = render(
      <Image {...BASE_PROPS} alt="" width={64} height={64} onLoad={onLoad} />,
    );
    fireEvent.load(container.querySelector("img")!);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});

describe("Image onError fallback (visual regression: broken image bled through the pulsing Skeleton)", () => {
  it("replaces the img with an ImageOff fallback box instead of leaving the Skeleton pulsing forever", () => {
    const { container } = render(<Image {...BASE_PROPS} alt="A generated image" />);
    fireEvent.error(container.querySelector("img")!);
    // No native <img> (and its browser broken-image glyph) remains in the DOM.
    expect(container.querySelector("img")).toBeNull();
    // No skeleton keeps pulsing behind a failed image.
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("calls the consumer's onError in addition to showing the fallback", () => {
    const onError = vi.fn();
    const { container } = render(<Image {...BASE_PROPS} alt="" onError={onError} />);
    fireEvent.error(container.querySelector("img")!);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
