# Atlas keyboard map

Atlas has one keyboard listener for the whole shell. It lives in `src/shell/keymap.ts`. The
Settings page shows the same list, read from `SHORTCUTS` in that file. When a shortcut
changes, update the code, and this page will then need updating to match.

`Mod` means ⌘ on macOS and Ctrl on Windows and Linux.

| Keys              | Second binding    | What it does                                                               |
| ----------------- | ----------------- | -------------------------------------------------------------------------- |
| `E`               |                   | Edit / Done: slide the editor and inspector in or out                      |
| `P`               |                   | Present the diagram                                                        |
| `L`               |                   | Switch between the technical and visual lens                               |
| `Mod` `K`         |                   | Command palette: switch diagram, go to a page                              |
| `Mod` `W`         | `Alt` `W`         | Close the diagram tab                                                      |
| `Mod` `Shift` `]` | `Alt` `Shift` `]` | Next tab                                                                   |
| `Mod` `Shift` `[` | `Alt` `Shift` `[` | Previous tab                                                               |
| `←` `→`           |                   | Previous / next story step (only while a story bar is shown)               |
| `Esc`             |                   | Back out: close the inspector, then leave edit mode, then leave presenting |
| `Mod` `B`         |                   | Show or hide the sidebar                                                   |
| `/`               |                   | Focus the workspace search (opens the sidebar first if it is collapsed)    |
| `Mod` `Z`         |                   | Undo (edit mode)                                                           |
| `Mod` `Shift` `Z` |                   | Redo (edit mode)                                                           |

## When shortcuts are ignored

- **Inside a text field.** Nothing fires while focus is in the YAML editor (Monaco), an input,
  a textarea, a select or anything editable. This includes `Mod` `K`, because Monaco uses it
  to start a two-key chord.
- **Inside menus and dialogs.** Single letters are left alone inside a menu, a listbox or a
  dialog, so typing to jump to an item still works there.
- **Where arrows already do something.** `←` and `→` are left alone on the canvas (they move
  the selected node), in tab strips, radio groups, toolbars, sliders and menus.
- **Key repeat.** Holding a key down does not repeat the action.

## Why some actions have an Alt / ⌥ binding

Chromium-based browsers act on `Mod` `W` themselves: they close the browser tab. They act on
`Mod` `Shift` `[` / `]` too, switching browser tabs. All of this happens before the page sees
the key, and the page cannot stop it with `preventDefault`. So each of those three actions
also answers to `Alt` / ⌥ with the same key. The browser leaves those combinations to the
page. Where the browser does pass the `Mod` combination through (Safari, a pinned app window),
both bindings work.
