/**
 * schema-display.test.tsx — XSS lock for `SchemaDisplayPath` (#1.1 review finding).
 *
 * `path` is untrusted tool/model output. It must never be interpolated into
 * `dangerouslySetInnerHTML` — the `{param}` highlight has to be rendered as
 * real `<span>` children, not raw HTML.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SchemaDisplay, SchemaDisplayHeader, SchemaDisplayPath } from "./schema-display";

describe("SchemaDisplayPath — XSS", () => {
  it("never injects HTML from the path, even when it contains markup", () => {
    const maliciousPath = '/users/{id}"><img src=x onerror=alert(1)>';

    const { container } = render(
      <SchemaDisplay method="GET" path={maliciousPath}>
        <SchemaDisplayHeader>
          <SchemaDisplayPath />
        </SchemaDisplayHeader>
      </SchemaDisplay>,
    );

    // The dangerous markup must render as literal text, never as a live element.
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.textContent).toContain(maliciousPath);
  });

  it("highlights {param} segments as separate span children", () => {
    render(
      <SchemaDisplay method="GET" path="/users/{id}/posts/{postId}">
        <SchemaDisplayHeader>
          <SchemaDisplayPath />
        </SchemaDisplayHeader>
      </SchemaDisplay>,
    );

    const idSpan = screen.getByText("{id}");
    const postIdSpan = screen.getByText("{postId}");
    expect(idSpan.tagName).toBe("SPAN");
    expect(postIdSpan.tagName).toBe("SPAN");
    expect(idSpan).toHaveClass("text-info-text");
  });

  it("renders an explicit path with no param braces verbatim", () => {
    render(
      <SchemaDisplay method="POST" path="/users">
        <SchemaDisplayHeader>
          <SchemaDisplayPath />
        </SchemaDisplayHeader>
      </SchemaDisplay>,
    );

    expect(screen.getByText("/users")).toBeInTheDocument();
  });
});
