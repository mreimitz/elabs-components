import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadList,
  FileUploadItem,
  type UploadFile,
} from "./file-upload";

const meta = {
  title: "Forms/FileUpload",
  component: FileUpload,
  tags: ["autodocs"],
  argTypes: {
    files: {
      description: "Controlled file list (`UploadFile[]`).",
      control: false,
      table: { category: "State" },
    },
    onFilesChange: {
      description: "Called when files are added or removed.",
      control: false,
      table: { category: "Behavior" },
    },
    accept: {
      description: "Accepted MIME types / extensions forwarded to the hidden `<input>`.",
      control: "text",
      table: { category: "Behavior" },
    },
    multiple: {
      description: "Allow selecting multiple files at once.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    maxSize: {
      description: "Maximum individual file size in bytes.",
      control: "number",
      table: { category: "Behavior" },
    },
    maxFiles: {
      description: "Maximum number of files in the list at once.",
      control: "number",
      table: { category: "Behavior" },
    },
    disabled: {
      description: "Disable all interactions.",
      control: "boolean",
      table: { category: "State" },
    },
    children: {
      description: "Compose with `FileUploadDropzone`, `FileUploadList`, and `FileUploadItem`.",
      control: false,
      table: { category: "Content" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof FileUpload>;
export default meta;
type Story = StoryObj<typeof meta>;

// Seed files for visual stories
function makeFakeFile(name: string, size: number): File {
  const file = new File(["x"], name, { type: "text/plain", lastModified: Date.now() });
  // Override the byte size so the stories display realistic file sizes.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

const seedFiles: UploadFile[] = [
  { id: "1", file: Object.assign(makeFakeFile("report.pdf", 204800), {}), status: "success" },
  {
    id: "2",
    file: Object.assign(makeFakeFile("data.csv", 51200), {}),
    status: "uploading",
    progress: 60,
  },
  {
    id: "3",
    file: Object.assign(makeFakeFile("broken.txt", 1024), {}),
    status: "error",
    errorMessage: "File exceeds size limit.",
  },
];

export const Default: Story = {
  render: () => (
    <div className="max-w-md">
      <FileUpload multiple accept="image/*,.pdf">
        <FileUploadDropzone />
        <FileUploadList>
          {seedFiles.map((f) => (
            <FileUploadItem
              key={f.id}
              uploadFile={f}
              status={f.status}
              progress={f.progress}
              errorMessage={f.errorMessage}
            />
          ))}
        </FileUploadList>
      </FileUpload>
    </div>
  ),
};

export const Uncontrolled: Story = {
  render: () => (
    <div className="max-w-md">
      <FileUpload multiple accept="image/*,.pdf,.docx" maxSize={5 * 1024 * 1024} maxFiles={5}>
        <FileUploadDropzone />
        <FileUploadList />
      </FileUpload>
    </div>
  ),
};

export const Controlled: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [files, setFiles] = useState<UploadFile[]>([]);
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <FileUpload files={files} onFilesChange={setFiles} multiple>
          <FileUploadDropzone />
          <FileUploadList>
            {files.map((f) => (
              <FileUploadItem key={f.id} uploadFile={f} />
            ))}
          </FileUploadList>
        </FileUpload>
        <p className="text-body text-muted-foreground">
          {files.length} file{files.length !== 1 ? "s" : ""} selected
        </p>
      </div>
    );
  },
};

export const WithProgress: Story = {
  render: () => (
    <div className="max-w-md">
      <FileUpload>
        <FileUploadDropzone />
        <FileUploadList>
          <FileUploadItem uploadFile={seedFiles[1]} status="uploading" progress={60} />
          <FileUploadItem uploadFile={seedFiles[0]} status="success" />
        </FileUploadList>
      </FileUpload>
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="max-w-md">
      <FileUpload>
        <FileUploadDropzone />
        <FileUploadList>
          <FileUploadItem
            uploadFile={seedFiles[2]}
            status="error"
            errorMessage="Server rejected the file."
          />
        </FileUploadList>
      </FileUpload>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="max-w-md">
      <FileUpload disabled>
        <FileUploadDropzone />
      </FileUpload>
    </div>
  ),
};
