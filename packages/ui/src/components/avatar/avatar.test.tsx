import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar, AvatarFallback, AvatarGroup } from "./avatar";
describe("Avatar", () => {
  it("renders the fallback", () => {
    render(
      <Avatar>
        <AvatarFallback>MR</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("MR")).toBeInTheDocument();
  });
  it("derives initials from `name` when there are no children", () => {
    render(
      <Avatar>
        <AvatarFallback name="Mara Osei" />
      </Avatar>,
    );
    expect(screen.getByText("MO")).toBeInTheDocument();
  });
  it("prefers explicit children over `name`", () => {
    render(
      <Avatar>
        <AvatarFallback name="Mara Osei">?</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.queryByText("MO")).not.toBeInTheDocument();
  });
});

describe("AvatarGroup", () => {
  const people = ["Mara Osei", "Tomás Reyes", "Ines Kahl", "Noor Haddad"];
  it("is a labelled group of its avatars", () => {
    render(
      <AvatarGroup aria-label="Reviewers">
        {people.map((p) => (
          <Avatar key={p}>
            <AvatarFallback name={p} />
          </Avatar>
        ))}
      </AvatarGroup>,
    );
    const group = screen.getByRole("group", { name: "Reviewers" });
    expect(group).toHaveAttribute("data-slot", "avatar-group");
    expect(group.querySelectorAll('[data-slot="avatar"]')).toHaveLength(4);
  });
  it("folds avatars past `max` into a +N tail, counting `total` when given", () => {
    const { rerender } = render(
      <AvatarGroup aria-label="People" max={2}>
        {people.map((p) => (
          <Avatar key={p}>
            <AvatarFallback name={p} />
          </Avatar>
        ))}
      </AvatarGroup>,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByRole("group").querySelectorAll('[data-slot="avatar"]')).toHaveLength(3);
    rerender(
      <AvatarGroup aria-label="People" max={2} total={1204}>
        {people.map((p) => (
          <Avatar key={p}>
            <AvatarFallback name={p} />
          </Avatar>
        ))}
      </AvatarGroup>,
    );
    expect(screen.getByText("+1202")).toBeInTheDocument();
  });
  it("shows no tail when nothing overflows", () => {
    render(
      <AvatarGroup aria-label="People" max={4}>
        {people.map((p) => (
          <Avatar key={p}>
            <AvatarFallback name={p} />
          </Avatar>
        ))}
      </AvatarGroup>,
    );
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });
});
