/**
 * Unit tests for the slash-menu shortcut helpers.
 * Pure functions — no React, no DOM engine needed beyond vitest's node env.
 */
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock monaco-editor — the shortcut module reads KeyMod/KeyCode constants at
// import time so we must hoist this before the import.
// ---------------------------------------------------------------------------
vi.mock("monaco-editor", () => {
  // Use real-ish numeric values that don't collide so we can assert bitwise ops.
  const KeyCode = {
    Slash: 85,
    Backspace: 1,
    Delete: 2,
    Escape: 9,
    Enter: 3,
    Tab: 2048,
    UpArrow: 16,
    DownArrow: 17,
    LeftArrow: 15,
    RightArrow: 18,
    // Letters KeyA..KeyZ
    KeyA: 31,
    KeyB: 32,
    KeyC: 33,
    KeyD: 34,
    KeyE: 35,
    KeyF: 36,
    KeyG: 37,
    KeyH: 38,
    KeyI: 39,
    KeyJ: 40,
    KeyK: 41,
    KeyL: 42,
    KeyM: 43,
    KeyN: 44,
    KeyO: 45,
    KeyP: 46,
    KeyQ: 47,
    KeyR: 48,
    KeyS: 49,
    KeyT: 50,
    KeyU: 51,
    KeyV: 52,
    KeyW: 53,
    KeyX: 54,
    KeyY: 55,
    KeyZ: 56,
  } as const;

  const KeyMod = {
    CtrlCmd: 2048,
    Shift: 1024,
    Alt: 512,
    WinCtrl: 256,
  } as const;

  return { KeyCode, KeyMod };
});

import { DEFAULT_SLASH_SHORTCUT, matchesKeyboardEvent } from "./shortcut";
// parseShortcut moved to the Monaco half (keeps ./shortcut Monaco-free); the
// monaco mock above backs it.
import { parseShortcut } from "./shortcut-monaco";

// Pull the mocked constants for assertions.
const { KeyCode, KeyMod } = await import("monaco-editor");

describe("DEFAULT_SLASH_SHORTCUT", () => {
  it("is Mod-Shift-O (NOT Mod-/, which collides with Monaco's Toggle Line Comment)", () => {
    expect(DEFAULT_SLASH_SHORTCUT).toBe("Mod-Shift-O");
  });
});

describe("parseShortcut", () => {
  it('parses "Mod-/" → CtrlCmd | Slash', () => {
    expect(parseShortcut("Mod-/")).toBe(KeyMod.CtrlCmd | KeyCode.Slash);
  });

  it('parses "Mod-Shift-K" → CtrlCmd | Shift | KeyK', () => {
    expect(parseShortcut("Mod-Shift-K")).toBe(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyK);
  });

  it("parses letter keys case-insensitively", () => {
    expect(parseShortcut("Mod-k")).toBe(parseShortcut("Mod-K"));
  });

  it('parses "Alt-/" → Alt | Slash', () => {
    expect(parseShortcut("Alt-/")).toBe(KeyMod.Alt | KeyCode.Slash);
  });

  it("throws for an unrecognized final key", () => {
    expect(() => parseShortcut("Mod-~")).toThrow();
  });
});

describe("matchesKeyboardEvent", () => {
  const makeEvent = (overrides: Partial<KeyboardEvent>): KeyboardEvent =>
    ({
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      key: "",
      ...overrides,
    }) as KeyboardEvent;

  describe('shortcut "Mod-/"', () => {
    it("matches when metaKey=true and key='/'", () => {
      expect(matchesKeyboardEvent("Mod-/", makeEvent({ metaKey: true, key: "/" }))).toBe(true);
    });

    it("matches when ctrlKey=true and key='/'", () => {
      expect(matchesKeyboardEvent("Mod-/", makeEvent({ ctrlKey: true, key: "/" }))).toBe(true);
    });

    it("does NOT match plain '/' (no modifier)", () => {
      expect(matchesKeyboardEvent("Mod-/", makeEvent({ key: "/" }))).toBe(false);
    });

    it("does NOT match wrong modifier (altKey only)", () => {
      expect(matchesKeyboardEvent("Mod-/", makeEvent({ altKey: true, key: "/" }))).toBe(false);
    });

    it("does NOT match wrong key with correct modifier", () => {
      expect(matchesKeyboardEvent("Mod-/", makeEvent({ metaKey: true, key: "k" }))).toBe(false);
    });

    it("does NOT match when an unexpected extra modifier is pressed (shift)", () => {
      expect(
        matchesKeyboardEvent("Mod-/", makeEvent({ metaKey: true, shiftKey: true, key: "/" })),
      ).toBe(false);
    });
  });

  describe('shortcut "Mod-Shift-K"', () => {
    it("matches Cmd+Shift+k (metaKey + shiftKey)", () => {
      expect(
        matchesKeyboardEvent("Mod-Shift-K", makeEvent({ metaKey: true, shiftKey: true, key: "k" })),
      ).toBe(true);
    });

    it("matches case-insensitively for the key", () => {
      expect(
        matchesKeyboardEvent("Mod-Shift-K", makeEvent({ metaKey: true, shiftKey: true, key: "K" })),
      ).toBe(true);
    });

    it("does NOT match without shift", () => {
      expect(matchesKeyboardEvent("Mod-Shift-K", makeEvent({ metaKey: true, key: "k" }))).toBe(
        false,
      );
    });
  });
});
