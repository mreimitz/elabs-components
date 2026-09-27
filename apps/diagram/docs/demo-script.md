# Atlas — the demo script (R1 spec in 12 clicks)

This is the wedge as a sequence. Every fortnight the agents run it in the browser; a failing step is the bug of the week. R1 is done when the maintainer runs it for a real deal and a colleague runs it without help.

Setup: `pnpm --filter @elabs-ai/diagram dev`, Qlik theme, workspace with the _Qlik Cloud + customer landscape_ template.

| #   | Click / key                                                                                              | Expected                                                                                   | Item                              |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| 1   | Open http://localhost:5180                                                                               | Home: recents, tree, components, "New from template"                                       | DG-22, DG-23                      |
| 2   | New from template → _Qlik Cloud + customer landscape_ (or _Qlik Talend Cloud pipeline_) → name "Contoso" | Diagram opens in **view** mode, on-brand look, technical lens, **particles flowing**       | DG-20, DG-21, DG-26, DG-67, DG-30 |
| 3   | Hover _Qlik Data Gateway_                                                                                | Details card: name, description, "Open docs ↗"                                             | DG-24, DG-25                      |
| 4   | Double-click the _Qlik Cloud tenant_ composite                                                           | Zoom-in drill-down, breadcrumb; Esc returns                                                | DG-27                             |
| 5   | `E`                                                                                                      | Editor + inspector slide in; canvas stays                                                  | DG-22                             |
| 6   | In the inspector rename _Postgres_ → "Contoso ERP (SAP)" and pick icon `sap/s4hana`                      | YAML updated, canvas updated, no re-layout jump                                            | DG-14 (v1), DG-28                 |
| 7   | In YAML type `- erp -> `                                                                                 | Completion lists ids with titles and marks; pick `tenant.qtdi`; add `: CDC`                | DG-28                             |
| 8   | `L`                                                                                                      | **Smooth morph** to the marketecture lens: boxes, lanes, pills, navy panels (Qlik rules)   | DG-36, DG-37, DG-38               |
| 9   | Play the story (▶)                                                                                       | Camera fits step 1, dims the rest, caption; → to step 2 follows the edge                   | DG-31                             |
| 10  | `P`                                                                                                      | Full-screen present; ←/→ work; Esc back                                                    | DG-31                             |
| 11  | Export → _Publish interactive HTML_ (customer-safe on)                                                   | One `.html` file; opened from Finder with no network: both lenses, story, hover cards      | DG-43                             |
| 12  | Close the tab, reopen the app                                                                            | "Contoso" is in recents with a thumbnail; the file is on disk under `workspace/customers/` | DG-21, DG-23                      |

Stretch (not R1): catalog panel drag (DG-29).
