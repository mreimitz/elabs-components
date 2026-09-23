import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { GeneratedImage, type GeneratedImageProps } from "./generated-image";
import { Image } from "./image";

const RED_DOT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

const BASE_PROPS: Pick<GeneratedImageProps, "base64" | "mediaType" | "uint8Array"> = {
  base64: RED_DOT,
  mediaType: "image/png",
  uint8Array: new Uint8Array(),
};

describe("GeneratedImage", () => {
  it("renders the img with the base64 data URI, alt, width and height", () => {
    const { container } = render(
      <GeneratedImage {...BASE_PROPS} alt="A red square" width={64} height={64} />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(`data:image/png;base64,${RED_DOT}`);
    expect(img?.getAttribute("alt")).toBe("A red square");
    expect(img?.getAttribute("width")).toBe("64");
    expect(img?.getAttribute("height")).toBe("64");
  });

  it('emits data-slot="generated-image", overriding the ui primitive’s slot', () => {
    const { container } = render(<GeneratedImage {...BASE_PROPS} />);
    expect(container.querySelector('[data-slot="generated-image"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="image"]')).toBeNull();
  });

  it("defaults alt to empty (decorative) rather than omitting it", () => {
    const { container } = render(<GeneratedImage {...BASE_PROPS} />);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("forwards a ref to the underlying <img>", () => {
    const ref = createRef<HTMLImageElement>();
    render(<GeneratedImage ref={ref} {...BASE_PROPS} />);
    expect(ref.current).toBeInstanceOf(HTMLImageElement);
  });
});

describe("GeneratedImage showSkeleton", () => {
  it("shows a Skeleton (decorative + one live region) until onLoad fires, when width+height are given", () => {
    const { container } = render(
      <GeneratedImage {...BASE_PROPS} alt="A red square" width={64} height={64} />,
    );
    const skeleton = container.querySelector('[data-slot="image-skeleton"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);

    fireEvent.load(container.querySelector("img")!);
    expect(container.querySelector('[data-slot="image-skeleton"]')).toBeNull();
  });

  it("defaults to no skeleton when width/height are not given — nothing to reserve", () => {
    const { container } = render(<GeneratedImage {...BASE_PROPS} alt="" />);
    expect(container.querySelector('[data-slot="image-skeleton"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("skips the skeleton when showSkeleton is explicitly false, even with width+height", () => {
    const { container } = render(
      <GeneratedImage {...BASE_PROPS} alt="" width={64} height={64} showSkeleton={false} />,
    );
    expect(container.querySelector('[data-slot="image-skeleton"]')).toBeNull();
  });

  it("keeps the bare <img> as the root when no skeleton is shown, so className resolves against the real parent", () => {
    const { container } = render(<GeneratedImage {...BASE_PROPS} alt="" className="w-full" />);
    expect(container.firstElementChild?.tagName).toBe("IMG");
    expect(container.firstElementChild).toHaveClass("w-full");
  });

  it("calls the consumer's onLoad in addition to clearing the skeleton", () => {
    const onLoad = vi.fn();
    const { container } = render(
      <GeneratedImage {...BASE_PROPS} alt="" width={64} height={64} onLoad={onLoad} />,
    );
    fireEvent.load(container.querySelector("img")!);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});

describe("GeneratedImage onError fallback", () => {
  it("replaces the img with the fallback box instead of leaving the Skeleton pulsing", () => {
    const onError = vi.fn();
    const { container } = render(
      <GeneratedImage {...BASE_PROPS} alt="A generated image" onError={onError} />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-slot="image-skeleton"]')).toBeNull();
    expect(container.querySelector('[role="img"][aria-label="A generated image"]')).not.toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("Image (deprecated alias)", () => {
  it("is the same component as GeneratedImage", () => {
    expect(Image).toBe(GeneratedImage);
  });
});
