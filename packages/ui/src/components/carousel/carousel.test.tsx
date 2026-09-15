import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DirectionProvider } from "@radix-ui/react-direction";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./carousel";

function renderCarousel(props: Partial<React.ComponentProps<typeof Carousel>> = {}) {
  return render(
    <Carousel {...props}>
      <CarouselContent>
        <CarouselItem>
          <input aria-label="slide input" defaultValue="abc" />
        </CarouselItem>
        <CarouselItem>Slide 2</CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>,
  );
}

describe("Carousel keyboard handling", () => {
  it("does not intercept ArrowLeft/ArrowRight when the target is a text input", () => {
    renderCarousel();
    const input = screen.getByLabelText("slide input") as HTMLInputElement;
    input.focus();
    const event = fireEvent.keyDown(input, { key: "ArrowRight", bubbles: true });
    // `fireEvent` returns `false` from `dispatchEvent` only when
    // `preventDefault()` was called — the carousel must leave the caret event
    // alone so it reaches the input's own default behavior.
    expect(event).toBe(true);
  });

  it("still intercepts ArrowLeft/ArrowRight outside of an editable target", () => {
    renderCarousel();
    const region = screen.getByRole("region");
    const event = fireEvent.keyDown(region, { key: "ArrowRight", bubbles: true });
    expect(event).toBe(false);
  });
});

describe("Carousel RTL keyboard mapping", () => {
  it("flips ArrowLeft/ArrowRight to the visually-adjacent slide under dir=rtl", () => {
    let scrollPrevSpy: ReturnType<typeof vi.spyOn> | undefined;
    let scrollNextSpy: ReturnType<typeof vi.spyOn> | undefined;
    render(
      <DirectionProvider dir="rtl">
        <Carousel
          setApi={(api) => {
            if (!api) return;
            scrollPrevSpy = vi.spyOn(api, "scrollPrev");
            scrollNextSpy = vi.spyOn(api, "scrollNext");
          }}
        >
          <CarouselContent>
            <CarouselItem>Slide 1</CarouselItem>
            <CarouselItem>Slide 2</CarouselItem>
          </CarouselContent>
        </Carousel>
      </DirectionProvider>,
    );
    const region = screen.getByRole("region");
    // In RTL, ArrowLeft is the visually-forward direction — it must trigger
    // the SAME embla call the "Next slide" button does, not "Previous".
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(scrollNextSpy).toHaveBeenCalledTimes(1);
    expect(scrollPrevSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(scrollPrevSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the physical mapping under dir=ltr (default)", () => {
    let scrollPrevSpy: ReturnType<typeof vi.spyOn> | undefined;
    let scrollNextSpy: ReturnType<typeof vi.spyOn> | undefined;
    render(
      <Carousel
        setApi={(api) => {
          if (!api) return;
          scrollPrevSpy = vi.spyOn(api, "scrollPrev");
          scrollNextSpy = vi.spyOn(api, "scrollNext");
        }}
      >
        <CarouselContent>
          <CarouselItem>Slide 1</CarouselItem>
          <CarouselItem>Slide 2</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );
    const region = screen.getByRole("region");
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(scrollNextSpy).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(scrollPrevSpy).toHaveBeenCalledTimes(1);
  });

  it("uses ArrowUp/ArrowDown instead of ArrowLeft/ArrowRight for a vertical carousel", () => {
    let scrollPrevSpy: ReturnType<typeof vi.spyOn> | undefined;
    let scrollNextSpy: ReturnType<typeof vi.spyOn> | undefined;
    render(
      <Carousel
        orientation="vertical"
        setApi={(api) => {
          if (!api) return;
          scrollPrevSpy = vi.spyOn(api, "scrollPrev");
          scrollNextSpy = vi.spyOn(api, "scrollNext");
        }}
      >
        <CarouselContent>
          <CarouselItem>Slide 1</CarouselItem>
          <CarouselItem>Slide 2</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );
    const region = screen.getByRole("region");
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(scrollNextSpy).not.toHaveBeenCalled();
    fireEvent.keyDown(region, { key: "ArrowDown" });
    expect(scrollNextSpy).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(region, { key: "ArrowUp" });
    expect(scrollPrevSpy).toHaveBeenCalledTimes(1);
  });
});

describe("CarouselPrevious / CarouselNext", () => {
  it("forward a ref to the underlying button", () => {
    const prevRef = createRef<HTMLButtonElement>();
    const nextRef = createRef<HTMLButtonElement>();
    renderCarousel();
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>1</CarouselItem>
        </CarouselContent>
        <CarouselPrevious ref={prevRef} />
        <CarouselNext ref={nextRef} />
      </Carousel>,
    );
    expect(prevRef.current).toBeInstanceOf(HTMLButtonElement);
    expect(nextRef.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("keeps the buttons inset on narrow viewports (no unconditional negative offset)", () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>1</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );
    const prev = screen.getByRole("button", { name: "Previous slide" });
    const next = screen.getByRole("button", { name: "Next slide" });
    // The negative offset that pushes the button outside the carousel box
    // only applies from `sm:` up; unconditionally offsetting it caused
    // horizontal overflow on narrow phone screens.
    expect(prev.className).not.toMatch(/(?<!sm:)-start-12/);
    expect(next.className).not.toMatch(/(?<!sm:)-end-12/);
    expect(prev.className).toContain("sm:-start-12");
    expect(next.className).toContain("sm:-end-12");
  });
});
