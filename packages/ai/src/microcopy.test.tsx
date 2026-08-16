import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@qlik-coe-emea/qlabs-components-ui";

import { Composer } from "./composer";
import { InlineCitationCard, InlineCitationCarouselNext } from "./inline-citation";
import { Message, MessageBranch, MessageBranchNext } from "./message";
import { PromptInput, PromptInputBody, PromptInputTextarea } from "./prompt-input";

/**
 * The locale seam is only real if microcopy can actually be overridden. These
 * tests assert both halves of the contract: the shipped English defaults are
 * byte-identical to what was hardcoded before (so adoption is non-breaking), and
 * a `LocaleProvider` can replace them.
 */

const de = {
  "ai.composer.placeholder": "Frag mich etwas…",
  "ai.message.nextBranch": "Nächster Zweig",
  "ai.promptInput.placeholder": "Was möchtest du wissen?",
  "ai.promptInput.uploadFiles": "Dateien hochladen",
  next: "Weiter",
};

describe("microcopy — English defaults are unchanged", () => {
  it("PromptInput keeps its shipped placeholder and upload label", () => {
    render(
      <PromptInput onSubmit={() => undefined}>
        <PromptInputBody>
          <PromptInputTextarea />
        </PromptInputBody>
      </PromptInput>,
    );
    expect(screen.getByPlaceholderText("What would you like to know?")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload files")).toBeInTheDocument();
  });

  it("Composer keeps its shipped placeholder", () => {
    render(<Composer />);
    expect(screen.getByPlaceholderText("Ask me anything…")).toBeInTheDocument();
  });

  it("message branch controls keep their shipped labels", () => {
    render(
      <MessageBranch>
        <MessageBranchNext />
      </MessageBranch>,
    );
    expect(screen.getByRole("button", { name: "Next branch" })).toBeInTheDocument();
  });
});

describe("microcopy — a LocaleProvider overrides it", () => {
  it("translates the PromptInput placeholder and upload label", () => {
    render(
      <LocaleProvider locale="de-DE" messages={de}>
        <PromptInput onSubmit={() => undefined}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
        </PromptInput>
      </LocaleProvider>,
    );
    expect(screen.getByPlaceholderText("Was möchtest du wissen?")).toBeInTheDocument();
    expect(screen.getByLabelText("Dateien hochladen")).toBeInTheDocument();
  });

  it("translates the Composer placeholder", () => {
    render(
      <LocaleProvider locale="de-DE" messages={de}>
        <Composer />
      </LocaleProvider>,
    );
    expect(screen.getByPlaceholderText("Frag mich etwas…")).toBeInTheDocument();
  });

  it("translates a namespaced @qlik-coe-emea/qlabs-components-ai aria-label", () => {
    render(
      <LocaleProvider locale="de-DE" messages={de}>
        <MessageBranch>
          <MessageBranchNext />
        </MessageBranch>
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Nächster Zweig" })).toBeInTheDocument();
  });

  it("reuses the GENERIC keys where they already existed", () => {
    // inline-citation hardcoded "Next" while DEFAULT_MESSAGES already had a
    // `next` key — the double gap the audit found. One override now covers both.
    render(
      <LocaleProvider locale="de-DE" messages={de}>
        <InlineCitationCard>
          <InlineCitationCarouselNext />
        </InlineCitationCard>
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Weiter" })).toBeInTheDocument();
  });

  it("an explicit prop still beats the locale bundle", () => {
    render(
      <LocaleProvider locale="de-DE" messages={de}>
        <Composer placeholder="Explicit wins" />
      </LocaleProvider>,
    );
    expect(screen.getByPlaceholderText("Explicit wins")).toBeInTheDocument();
  });
});

describe("microcopy — no provider is required", () => {
  it("renders English with no LocaleProvider ancestor at all", () => {
    // useLocale is provider-optional, which is what makes adoption non-breaking.
    render(
      <Message from="assistant">
        <MessageBranch>
          <MessageBranchNext />
        </MessageBranch>
      </Message>,
    );
    expect(screen.getByRole("button", { name: "Next branch" })).toBeInTheDocument();
  });
});
