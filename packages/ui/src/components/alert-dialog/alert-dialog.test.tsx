import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";

describe("AlertDialogContent overflow", () => {
  it("caps height and scrolls a long body instead of overflowing the viewport", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogDescription>Description</AlertDialogDescription>
          </AlertDialogHeader>
          Body
        </AlertDialogContent>
      </AlertDialog>,
    );
    const content = screen.getByRole("alertdialog");
    // Without a height ceiling + `overflow-y-auto`, a body longer than the
    // viewport overflows past both edges — and the `-translate-y-1/2`
    // centring pushes its top half off-screen, unreachable even by scrolling
    // the page.
    expect(content.className).toContain("max-h-[85dvh]");
    expect(content.className).toContain("overflow-y-auto");
  });
});
