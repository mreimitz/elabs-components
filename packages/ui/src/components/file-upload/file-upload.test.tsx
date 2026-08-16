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
  it("renders the dropzone with a label pointing to the hidden input", () => {
    render(
      <FileUpload>
        <FileUploadDropzone />
      </FileUpload>,
    );
    // The label wraps the input — label's htmlFor matches input's id
    const label = document.querySelector("label[data-slot='file-upload-dropzone']");
    expect(label).not.toBeNull();
    const inputId = label!.getAttribute("for");
    expect(inputId).toBeTruthy();
    const input = document.getElementById(inputId!);
    expect(input).not.toBeNull();
    expect(input!.tagName.toLowerCase()).toBe("input");
    expect(input).toHaveAttribute("type", "file");
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

  it("FileUploadList renders role=status and aria-live=polite", () => {
    const f = makeUploadFile();
    render(
      <FileUpload files={[f]} onFilesChange={() => {}}>
        <FileUploadList>
          <FileUploadItem uploadFile={f} />
        </FileUploadList>
      </FileUpload>,
    );
    const list = screen.getByRole("status");
    expect(list).toHaveAttribute("aria-live", "polite");
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
