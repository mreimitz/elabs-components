import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDialogDismissGuard } from "./use-dialog-dismiss-guard";

describe("useDialogDismissGuard", () => {
  it("holds the dialog open and raises the confirmation when dirty", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDialogDismissGuard({ dirty: true, onClose }));

    act(() => result.current.onOpenChange(false));

    expect(result.current.confirmOpen).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("confirmDiscard() closes both the confirmation and the dialog", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDialogDismissGuard({ dirty: true, onClose }));

    act(() => result.current.onOpenChange(false));
    act(() => result.current.confirmDiscard());

    expect(result.current.confirmOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes immediately and never confirms when not dirty", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDialogDismissGuard({ dirty: false, onClose }));

    act(() => result.current.onOpenChange(false));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.confirmOpen).toBe(false);
  });

  it("never treats opening as a dismissal", () => {
    const onClose = vi.fn();
    const onOpen = vi.fn();
    const { result } = renderHook(() => useDialogDismissGuard({ dirty: true, onClose, onOpen }));

    act(() => result.current.onOpenChange(true));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.confirmOpen).toBe(false);
  });

  // The AC's asymmetry: a save path that closes the dialog by setting the app's
  // own `open` to false never reaches the guard, so it cannot prompt. This test
  // documents that it is structural — there is no "skip the guard" flag to get
  // wrong — by asserting the hook stays inert across a dirty rerender.
  it("is unobservable to a programmatic close (the save path)", () => {
    const onClose = vi.fn();
    const { result, rerender } = renderHook(
      ({ dirty }) => useDialogDismissGuard({ dirty, onClose }),
      { initialProps: { dirty: true } },
    );

    // The app saved, cleared its dirty flag and closed the dialog itself.
    rerender({ dirty: false });

    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.confirmOpen).toBe(false);
  });

  it("reads the CURRENT dirty value, not the one captured at mount", () => {
    const onClose = vi.fn();
    const { result, rerender } = renderHook(
      ({ dirty }) => useDialogDismissGuard({ dirty, onClose }),
      { initialProps: { dirty: true } },
    );

    rerender({ dirty: false });
    act(() => result.current.onOpenChange(false));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.confirmOpen).toBe(false);
  });
});
