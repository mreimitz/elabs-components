import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
  getMediaCategory,
  type AttachmentData,
  type AttachmentVariant,
} from "./attachments";

afterEach(cleanup);

const IMAGE: AttachmentData = {
  id: "photo",
  type: "file",
  mediaType: "image/png",
  filename: "photo.png",
  url: "data:image/png;base64,iVBORw0KGgo=",
};
const VIDEO: AttachmentData = {
  id: "clip",
  type: "file",
  mediaType: "video/mp4",
  filename: "clip.mp4",
  url: "data:video/mp4;base64,AAAA",
};
const DOC: AttachmentData = {
  id: "doc",
  type: "file",
  mediaType: "application/pdf",
  filename: "report.pdf",
  url: "",
};

function renderAll(variant: AttachmentVariant, onRemove = vi.fn()) {
  render(
    <Attachments variant={variant}>
      {[IMAGE, VIDEO, DOC].map((item) => (
        <Attachment key={item.id} data={item} onRemove={() => onRemove(item.id)}>
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>,
  );
  return onRemove;
}

describe("Attachments", () => {
  it.each<AttachmentVariant>(["grid", "inline", "list"])(
    "renders image and video thumbnails in the %s variant",
    (variant) => {
      renderAll(variant);
      const img = screen.getByRole("img", { name: "photo.png" });
      expect(img.tagName).toBe("IMG");
      expect(img).toHaveAttribute("data-slot", "image");
      expect(img).toHaveClass("object-cover");
      expect(img).toHaveAttribute("width", variant === "grid" ? "96" : "20");

      const video = document.querySelector("video");
      expect(video).not.toBeNull();
      expect(video?.muted).toBe(true);
      expect(video).not.toHaveAttribute("controls");
      expect(video?.closest('[aria-hidden="true"]')).not.toBeNull();
    },
  );

  it("shows the file name outside the grid variant, never in it", () => {
    renderAll("list");
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    cleanup();
    renderAll("grid");
    expect(screen.queryByText("report.pdf")).not.toBeInTheDocument();
  });

  it("calls onRemove for the clicked item only", () => {
    const onRemove = renderAll("list");
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith("photo");
  });

  it("renders no remove button without an onRemove callback", () => {
    render(
      <Attachments>
        <Attachment data={IMAGE}>
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      </Attachments>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("classifies media types", () => {
    expect(getMediaCategory(IMAGE)).toBe("image");
    expect(getMediaCategory(VIDEO)).toBe("video");
    expect(getMediaCategory(DOC)).toBe("document");
  });
});
