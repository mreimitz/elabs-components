import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LogoStrip } from "./logo-strip";

describe("LogoStrip", () => {
  it("renders the default caption", () => {
    render(<LogoStrip logos={[<span key="a">Logo A</span>]} animate={false} />);
    expect(screen.getByText("Trusted by teams everywhere")).toBeInTheDocument();
  });

  it("renders a custom caption", () => {
    render(
      <LogoStrip
        logos={[<span key="a">Logo A</span>]}
        caption="Used by the best"
        animate={false}
      />,
    );
    expect(screen.getByText("Used by the best")).toBeInTheDocument();
  });

  it("renders provided logo nodes", () => {
    render(
      <LogoStrip
        logos={[
          <span key="a">Acme Inc</span>,
          <span key="b">Globex</span>,
          <span key="c">Initech</span>,
        ]}
        animate={false}
      />,
    );
    expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(screen.getByText("Initech")).toBeInTheDocument();
  });

  it("renders without a caption when caption is falsy", () => {
    render(<LogoStrip logos={[<span key="a">Logo A</span>]} caption={null} animate={false} />);
    expect(screen.queryByText("Trusted by teams everywhere")).not.toBeInTheDocument();
  });
});
