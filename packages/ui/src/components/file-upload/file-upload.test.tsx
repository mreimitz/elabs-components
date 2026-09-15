import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadList,
  FileUploadItem,
  type UploadFile,
} from "./file-upload";

function makeUploadFile(name = "test.txt", size = 1024): UploadFile {
  const file = new File(["x"], name, { type: "text/plain" });
  Object.defineProperty(file, "size", { value: size });
  return { id: `id-${name}`, file };
}

describe("FileUpload", () => {
  it("default dropzone exposes exactly one control: the Browse files button", () => {
    render(
      <FileUpload>
        <FileUploadDropzone />
      </FileUpload>,
    );
    const dropzone = document.querySelector("[data-slot='file-upload-dropzone']")!;
    // The zone is a plain drop surface — no role, no tab stop — so the inner
    // button is never nested inside another interactive element (axe
    // `nested-interactive` / `aria-allowed-role`).
    expect(dropzone.tagName.toLowerCase()).toBe("div");
    expect(dropzone).not.toHaveAttribute("role");
    expect(dropzone).not.toHaveAttribute("tabIndex");
    expect(screen.getAllByRole("button")).toHaveLength(1);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "Browse files" }));
    // One activation opens the picker once (the zone's click must not re-fire it).
    expect(clickSpy).toHaveBeenCalledTimes(1);
    fireEvent.click(dropzone);
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it("hidden file input has sr-only class (visually hidden but real)", () => {
    render(
      <FileUpload>
        <FileUploadDropzone />
      </FileUpload>,
    );
    const input = document.querySelector("input[type='file']");
    expect(input).not.toBeNull();
    expect(input).toHaveClass("sr-only");
  });

  it("calls onFilesChange when a file is added (controlled)", () => {
    const onFilesChange = vi.fn();
    render(
      <FileUpload files={[]} onFilesChange={onFilesChange}>
        <FileUploadDropzone />
      </FileUpload>,
    );
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFilesChange).toHaveBeenCalledOnce();
    expect(onFilesChange.mock.calls[0]![0]).toHaveLength(1);
    expect(onFilesChange.mock.calls[0]![0][0].file.name).toBe("hello.txt");
  });

  it("respects maxFiles — does not exceed the limit", () => {
    const onFilesChange = vi.fn();
    render(
      <FileUpload files={[]} onFilesChange={onFilesChange} maxFiles={1}>
        <FileUploadDropzone />
      </FileUpload>,
    );
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const files = [
      new File(["a"], "a.txt", { type: "text/plain" }),
      new File(["b"], "b.txt", { type: "text/plain" }),
    ];
    fireEvent.change(input, { target: { files } });
    expect(onFilesChange.mock.calls[0]![0]).toHaveLength(1);
  });

  it("respects maxSize — skips files over the limit", () => {
    const onFilesChange = vi.fn();
    render(
      <FileUpload files={[]} onFilesChange={onFilesChange} maxSize={10}>
        <FileUploadDropzone />
      </FileUpload>,
    );
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    // File content "x".repeat(100) is 100 bytes > 10
    const big = new File(["x".repeat(100)], "big.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [big] } });
    expect(onFilesChange.mock.calls[0]![0]).toHaveLength(0);
  });

  it("FileUploadList announces via aria-live while keeping its native list role", () => {
    // NOT role="status" — that would override the <ul>'s implicit `list`
    // role and strip `listitem` from every <FileUploadItem> inside it
    // (an axe `listitem` violation). `aria-live="polite"` alone still
    // announces additions/removals to assistive tech.
    const f = makeUploadFile();
    render(
      <FileUpload files={[f]} onFilesChange={() => {}}>
        <FileUploadList>
          <FileUploadItem uploadFile={f} />
        </FileUploadList>
      </FileUpload>,
    );
    const list = screen.getByRole("list");
    expect(list).toHaveAttribute("aria-live", "polite");
    expect(list).not.toHaveAttribute("role");
  });

  it("FileUploadList returns null when no files and no children", () => {
    const { container } = render(
      <FileUpload files={[]} onFilesChange={() => {}}>
        <FileUploadList />
      </FileUpload>,
    );
    expect(container.querySelector("[data-slot='file-upload-list']")).toBeNull();
  });

  it("FileUploadItem shows progress bar when status=uploading", () => {
    const f = makeUploadFile();
    render(
      <FileUpload files={[f]} onFilesChange={() => {}}>
        <FileUploadList>
          <FileUploadItem uploadFile={f} status="uploading" progress={42} />
        </FileUploadList>
      </FileUpload>,
    );
    // Progress bar is present (Radix renders a progressbar role)
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("FileUploadItem shows role=alert for error messages", () => {
    const f = makeUploadFile();
    render(
      <FileUpload files={[f]} onFilesChange={() => {}}>
        <FileUploadList>
          <FileUploadItem uploadFile={f} status="error" errorMessage="Upload failed." />
        </FileUploadList>
      </FileUpload>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Upload failed.");
  });

  it("remove button calls removeFile via context", () => {
    const onFilesChange = vi.fn();
    const f = makeUploadFile("removeme.txt");
    render(
      <FileUpload files={[f]} onFilesChange={onFilesChange}>
        <FileUploadList>
          <FileUploadItem uploadFile={f} />
        </FileUploadList>
      </FileUpload>,
    );
    const removeBtn = screen.getByRole("button", { name: /remove removeme/i });
    fireEvent.click(removeBtn);
    expect(onFilesChange).toHaveBeenCalledWith([]);
  });

  it("drag-and-drop rejects files that don't match `accept` and reports why", () => {
    const onFilesChange = vi.fn();
    const onFilesRejected = vi.fn();
    render(
      <FileUpload
        files={[]}
        onFilesChange={onFilesChange}
        onFilesRejected={onFilesRejected}
        accept=".png"
      >
        <FileUploadDropzone />
      </FileUpload>,
    );
    const dropzone = document.querySelector("[data-slot='file-upload-dropzone']")!;
    const wrongType = new File(["x"], "notes.txt", { type: "text/plain" });
    fireEvent.drop(dropzone, { dataTransfer: { files: [wrongType] } });

    // A drop bypasses the native <input accept> filter entirely — without
    // this, a dragged-in .txt would be added even though the picker would
    // never have offered it.
    expect(onFilesChange).toHaveBeenCalledWith([]);
    expect(onFilesRejected).toHaveBeenCalledWith([{ file: wrongType, reason: "accept" }]);
  });

  it("drag-and-drop of several files when multiple=false keeps only the first, rejects the rest", () => {
    const onFilesChange = vi.fn();
    const onFilesRejected = vi.fn();
    render(
      <FileUpload files={[]} onFilesChange={onFilesChange} onFilesRejected={onFilesRejected}>
        <FileUploadDropzone />
      </FileUpload>,
    );
    const dropzone = document.querySelector("[data-slot='file-upload-dropzone']")!;
    const first = new File(["a"], "a.txt", { type: "text/plain" });
    const second = new File(["b"], "b.txt", { type: "text/plain" });
    fireEvent.drop(dropzone, { dataTransfer: { files: [first, second] } });

    // `multiple` is only enforced by the browser for the picker dialog, never
    // for a raw DataTransfer drop.
    expect(onFilesChange.mock.calls[0]![0]).toHaveLength(1);
    expect(onFilesChange.mock.calls[0]![0][0].file.name).toBe("a.txt");
    expect(onFilesRejected).toHaveBeenCalledWith([{ file: second, reason: "multiple" }]);
  });

  it("a custom-children dropzone still opens the picker on Enter/Space (keyboard reachable)", () => {
    render(
      <FileUpload>
        <FileUploadDropzone>Drop it here</FileUploadDropzone>
      </FileUpload>,
    );
    // With custom `children` there is no fallback "Browse files" button —
    // the zone itself must be the one control: a tab stop answering Enter/Space.
    const dropzone = screen.getByRole("button");
    expect(dropzone).toHaveTextContent("Drop it here");
    expect(dropzone).toHaveAttribute("data-slot", "file-upload-dropzone");
    expect(dropzone).toHaveAttribute("tabIndex", "0");

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.keyDown(dropzone, { key: "Enter" });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(dropzone, { key: " " });
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it("disabled prop disables the file input and remove buttons", () => {
    const f = makeUploadFile();
    render(
      <FileUpload files={[f]} onFilesChange={() => {}} disabled>
        <FileUploadDropzone />
        <FileUploadList>
          <FileUploadItem uploadFile={f} />
        </FileUploadList>
      </FileUpload>,
    );
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    expect(input).toBeDisabled();
    const removeBtn = screen.getByRole("button", { name: /remove/i });
    expect(removeBtn).toBeDisabled();
  });
});
