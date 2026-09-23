import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { Image } from "./image";

const SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'/%3E";
const OTHER_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'/%3E";

const skeleton = (c: HTMLElement) => c.querySelector('[data-slot="image-skeleton"]');
const statusRegions = (c: HTMLElement) => c.querySelectorAll('[role="status"]');

describe("Image — attributes, ref, slot", () => {
  it("renders the img with src, alt, width and height", () => {
    const { container } = render(<Image src={SRC} alt="A square" width={64} height={48} />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", SRC);
    expect(img).toHaveAttribute("alt", "A square");
    expect(img).toHaveAttribute("width", "64");
    expect(img).toHaveAttribute("height", "48");
  });

  it("keeps alt as an empty attribute (decorative) at runtime even when omitted", () => {
    const { container } = render(
      <Image {...({ src: SRC } as unknown as { src: string; alt: string })} />,
    );
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("forwards a ref to the <img>", () => {
    const ref = createRef<HTMLImageElement>();
    render(<Image ref={ref} src={SRC} alt="" />);
    expect(ref.current).toBeInstanceOf(HTMLImageElement);
  });

  it("puts data-slot, className, style and native attrs on the img root", () => {
    const { container } = render(
      <Image
        src={SRC}
        alt=""
        className="w-full rounded-md"
        style={{ width: "50%" }}
        loading="lazy"
        fit="none"
      />,
    );
    const img = container.firstElementChild as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("data-slot", "image");
    expect(img).toHaveClass("w-full", "rounded-md", "object-none");
    expect(img.style.width).toBe("50%");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("data-status", "loading");
  });

  it("lets a wrapper override data-slot (emitted before props)", () => {
    const { container } = render(
      <Image src={SRC} alt="" {...{ "data-slot": "queue-item-image" }} />,
    );
    expect(container.querySelector("img")).toHaveAttribute("data-slot", "queue-item-image");
  });

  it("fit emits only object-* classes, default contain", () => {
    const { container } = render(<Image src={SRC} alt="" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveClass("object-contain");
    expect(img.className).not.toMatch(/(^|\s)(w|h|size)-/);
  });
});

describe("Image — skeleton defaults and frame", () => {
  it("no size → bare img, no skeleton, no live region", () => {
    const { container } = render(<Image src={SRC} alt="Photo" className="w-full" />);
    expect(container.firstElementChild?.tagName).toBe("IMG");
    expect(skeleton(container)).toBeNull();
    expect(statusRegions(container)).toHaveLength(0);
  });

  it("width+height → inline frame with skeleton sized to the box", () => {
    const { container } = render(<Image src={SRC} alt="Photo" width={64} height={48} />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame).toHaveAttribute("data-slot", "image-frame");
    expect(frame).toHaveClass("inline-block");
    expect(frame.style.width).toBe("64px");
    expect(frame.style.height).toBe("48px");
    expect(skeleton(container)).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toHaveClass("size-full");
  });

  it("aspectRatio → AspectRatio frame with skeleton; img fills it", () => {
    const { container } = render(<Image src={SRC} alt="Photo" aspectRatio={16 / 9} />);
    const frame = container.querySelector('[data-slot="image-frame"]')!;
    expect(frame).toHaveClass("relative", "overflow-hidden");
    expect(skeleton(container)).not.toBeNull();
    expect(container.querySelector("img")).toHaveClass("size-full");
  });

  it("showSkeleton without a size → size-full block frame (fills a parent box)", () => {
    const { container } = render(<Image src={SRC} alt="" showSkeleton />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame).toHaveAttribute("data-slot", "image-frame");
    expect(frame).toHaveClass("block", "size-full");
    expect(skeleton(container)).not.toBeNull();
  });

  it("showSkeleton={false} with width+height → bare img", () => {
    const { container } = render(
      <Image src={SRC} alt="" width={12} height={12} showSkeleton={false} />,
    );
    expect(container.firstElementChild?.tagName).toBe("IMG");
    expect(skeleton(container)).toBeNull();
  });

  it("aspectRatio with showSkeleton={false} keeps the frame but no skeleton / live region", () => {
    const { container } = render(
      <Image src={SRC} alt="Photo" aspectRatio={1} showSkeleton={false} />,
    );
    expect(container.querySelector('[data-slot="image-frame"]')).not.toBeNull();
    expect(skeleton(container)).toBeNull();
    expect(statusRegions(container)).toHaveLength(0);
  });
});

describe("Image — live region", () => {
  it("mounts exactly one role=status when alt is set, text one tick later", async () => {
    const { container } = render(<Image src={SRC} alt="Photo" width={64} height={48} />);
    const regions = statusRegions(container);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toHaveAttribute("aria-live", "polite");
    await act(async () => {});
    expect(regions[0]).toHaveTextContent("Loading…");
    fireEvent.load(container.querySelector("img")!);
    await act(async () => {});
    expect(regions[0]).toHaveTextContent("");
  });

  it("mounts no live region for a decorative image", () => {
    const { container } = render(<Image src={SRC} alt="" width={64} height={48} />);
    expect(skeleton(container)).not.toBeNull();
    expect(statusRegions(container)).toHaveLength(0);
  });
});

describe("Image — load and error events", () => {
  it("load clears the skeleton, sets data-status and calls onLoad", () => {
    const onLoad = vi.fn();
    const { container } = render(<Image src={SRC} alt="" width={64} height={48} onLoad={onLoad} />);
    const img = container.querySelector("img")!;
    fireEvent.load(img);
    expect(skeleton(container)).toBeNull();
    expect(img).toHaveAttribute("data-status", "loaded");
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it("error removes the img, shows the ImageOff fallback and calls onError", () => {
    const onError = vi.fn();
    const { container } = render(
      <Image src={SRC} alt="" width={64} height={48} onError={onError} />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(skeleton(container)).toBeNull();
    const fb = container.querySelector('[data-slot="image-fallback"]')!;
    expect(fb.querySelector("svg")).not.toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("Image — cached (complete) path", () => {
  function mockComplete(naturalWidth: number, currentSrc: string) {
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const nw = vi
      .spyOn(HTMLImageElement.prototype, "naturalWidth", "get")
      .mockReturnValue(naturalWidth);
    const cs = vi
      .spyOn(HTMLImageElement.prototype, "currentSrc", "get")
      .mockReturnValue(currentSrc);
    return () => {
      complete.mockRestore();
      nw.mockRestore();
      cs.mockRestore();
    };
  }

  it("an already-decoded image is marked loaded on mount", () => {
    const restore = mockComplete(4, SRC);
    try {
      const { container } = render(<Image src={SRC} alt="" width={64} height={48} />);
      expect(skeleton(container)).toBeNull();
      expect(container.querySelector("img")).toHaveAttribute("data-status", "loaded");
    } finally {
      restore();
    }
  });

  it("an already-failed image (complete, zero natural width, currentSrc) shows the fallback", () => {
    const restore = mockComplete(0, SRC);
    try {
      const { container } = render(<Image src={SRC} alt="Photo" />);
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector('[data-slot="image-fallback"]')).not.toBeNull();
    } finally {
      restore();
    }
  });

  it("complete with no currentSrc is a no-op (still loading)", () => {
    const restore = mockComplete(0, "");
    try {
      const { container } = render(<Image src={SRC} alt="" width={64} height={48} />);
      expect(skeleton(container)).not.toBeNull();
    } finally {
      restore();
    }
  });
});

describe("Image — fallback semantics", () => {
  it("non-empty alt → fallback is role=img with the alt as its name", () => {
    const { container, getByRole } = render(<Image src={SRC} alt="A red square" />);
    fireEvent.error(container.querySelector("img")!);
    expect(getByRole("img", { name: "A red square" })).toHaveAttribute(
      "data-slot",
      "image-fallback",
    );
  });

  it("empty alt → fallback is aria-hidden and not an img", () => {
    const { container, queryByRole } = render(<Image src={SRC} alt="" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector('[data-slot="image-fallback"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(queryByRole("img")).toBeNull();
  });

  it("custom fallback replaces the default box", () => {
    const { container, getByText } = render(
      <Image src={SRC} alt="Logo" fallback={<span>no logo</span>} />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(getByText("no logo")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="image-fallback"]')).toBeNull();
  });

  it("fallback={null} renders nothing on error", () => {
    const { container } = render(<Image src={SRC} alt="" fallback={null} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container).toBeEmptyDOMElement();
  });

  it("falsy src renders the fallback immediately, no img", () => {
    const { container, getByText } = render(<Image src="" alt="Bot" fallback={<span>bot</span>} />);
    expect(container.querySelector("img")).toBeNull();
    expect(getByText("bot")).toBeInTheDocument();
  });
});

describe("Image — src change resets status", () => {
  it("a new src after an error renders the img again, loading", () => {
    const { container, rerender } = render(<Image src={SRC} alt="" width={64} height={48} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    rerender(<Image src={OTHER_SRC} alt="" width={64} height={48} />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", OTHER_SRC);
    expect(img).toHaveAttribute("data-status", "loading");
    expect(skeleton(container)).not.toBeNull();
  });

  it("the frame persists across load (no remount mid-load)", () => {
    const { container } = render(<Image src={SRC} alt="" width={64} height={48} />);
    const frame = container.firstElementChild;
    const img = container.querySelector("img");
    fireEvent.load(img!);
    expect(container.firstElementChild).toBe(frame);
    expect(container.querySelector("img")).toBe(img);
  });
});
