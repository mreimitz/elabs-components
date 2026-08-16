import { beforeAll, describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { Toaster, toast } from "./sonner";

// jsdom does not provide ResizeObserver, which sonner uses internally to
// measure each toast's height.
beforeAll(() => {
  if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
    // @ts-expect-error jsdom stub
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe("Toaster", () => {
  it('merges a consumer\'s className with the default "toaster group" wrapper classes (#389)', async () => {
    render(<Toaster className="my-custom-class" />);
    toast("Hello world");

    // Wait for the wrapper (ol element) to appear
    const wrapper = await waitFor(() => {
      const el = document.querySelector("[data-sonner-toaster]");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });

    // The wrapper must contain BOTH the default classes AND the consumer's class
    expect(wrapper).toHaveClass("toaster");
    expect(wrapper).toHaveClass("group");
    expect(wrapper).toHaveClass("my-custom-class");
  });

  it("merges a consumer's toastOptions.classNames into the defaults instead of replacing them (#362)", async () => {
    render(<Toaster toastOptions={{ classNames: { toast: "extra-class" } }} />);
    toast("Deployment started", {
      description: "billing@v1.4.2",
      action: { label: "Undo", onClick: () => {} },
      cancel: { label: "Dismiss", onClick: () => {} },
    });

    const toastEl = await waitFor(() => {
      const el = document.querySelector("[data-sonner-toast]");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });

    // The consumer's override is present...
    expect(toastEl.className).toContain("extra-class");
    // ...EXTENDING the default `toast` classes, not replacing them.
    expect(toastEl.className).toContain("group-[.toaster]:bg-card");

    // Sibling classNames the consumer did NOT touch still carry their
    // library-default token-backed classes — proving the merge is deep
    // (per-key), not just that `toast` itself survived.
    expect(document.querySelector("[data-description]")).toHaveClass(
      "group-[.toast]:text-muted-foreground",
    );
    expect(document.querySelector("[data-action]")).toHaveClass("group-[.toast]:bg-primary");
    expect(document.querySelector("[data-cancel]")).toHaveClass("group-[.toast]:bg-muted");
  });

  it("<Toaster /> with no toastOptions renders the default classes unchanged (regression guard)", async () => {
    render(<Toaster />);
    toast("Plain toast");

    const toastEl = await waitFor(() => {
      const el = document.querySelector("[data-sonner-toast]");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(toastEl).toHaveClass("group-[.toaster]:bg-card");
  });
});
