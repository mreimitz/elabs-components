import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Heading, InlineCode, Link, List, ListItem, Text } from "./prose";

afterEach(cleanup);

describe("prose primitives", () => {
  it("renders the heading element for the given level", () => {
    render(<Heading level={3}>Title</Heading>);
    const h = screen.getByRole("heading", { level: 3, name: "Title" });
    expect(h.tagName).toBe("H3");
  });

  it("adds safe rel + target for external links", () => {
    render(<Link href="https://example.com">Out</Link>);
    const a = screen.getByRole("link", { name: "Out" });
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not externalize relative links", () => {
    render(<Link href="/docs">In</Link>);
    expect(screen.getByRole("link", { name: "In" })).not.toHaveAttribute("target");
  });

  it("renders an ordered list when asked", () => {
    render(
      <List ordered>
        <ListItem>one</ListItem>
      </List>,
    );
    expect(screen.getByRole("list").tagName).toBe("OL");
  });

  it("renders inline code + body text", () => {
    render(
      <Text>
        see <InlineCode>cn()</InlineCode>
      </Text>,
    );
    expect(screen.getByText("cn()").tagName).toBe("CODE");
  });
});
