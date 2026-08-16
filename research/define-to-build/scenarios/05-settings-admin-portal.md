# Scenario 05 — Settings / Admin Portal

**Archetype:** Settings / Portal
**User type:** Full-stack developer building an internal admin or SaaS settings page

---

## What's needed

A multi-section settings or admin portal. The user needs tabbed sections with different
form types — text inputs, toggles, dropdowns, radio groups — plus a confirmatory
pattern for destructive actions. Layout and focus management should feel correct out of
the box: labels tied to controls, proper tab order, inline error messages, unsaved-change
warnings.

**Components required:**

- `AppShell` + `Sidebar` — main app shell (settings as one section)
- `PageShell` — settings page container with title + description
- `Tabs` — General / Notifications / Security / Billing
- **General tab:**
  - `Form` + `Input` (name, email, bio)
  - `Avatar` — current profile photo + upload button
  - `Button` — save changes
- **Notifications tab:**
  - `Form` + `Switch` (×6) — per-notification-type toggle
  - `Select` — notification frequency
  - `RadioGroup` — delivery channel (email / push / both)
- **Security tab:**
  - `Form` + `Input type="password"` — change password (with confirm)
  - `Badge` — "2FA enabled" status
  - `Button` — enable/disable 2FA
  - `DataTable` — active sessions (device, location, last active, revoke action)
  - `AlertDialog` — confirm "revoke all sessions"
- **Billing tab:**
  - `Badge` — current plan (Pro / Team / Enterprise)
  - `MetricCard` (×2) — monthly API calls used, storage used
  - `Card` — payment method (masked card number + update button)
  - `Button variant="destructive"` — cancel subscription
  - `AlertDialog` — confirm cancellation with consequences listed

---

## How the user would define requirements

Ideal intake:

> "I need a settings page with four tabs: General, Notifications, Security, Billing.
>
> General: editable name, email, and bio fields. A profile photo with an upload button.
> Save button that stays disabled until something changes and shows a spinner on submit.
>
> Notifications: toggles for 6 notification types (new message, mention, weekly digest,
> security alerts, product updates, billing alerts). A 'delivery channel' radio group
> (email / push / both). Save button.
>
> Security: change password form (current, new, confirm — with password rules shown as
> you type). A 2FA section with a status badge and enable/disable button. A table of
> active sessions (device name, browser, location, last active time) with a 'revoke'
> button per row and a 'revoke all' button with a confirmation dialog.
>
> Billing: show the current plan as a badge, API usage and storage as KPI tiles, the
> current payment method (last 4 digits + brand logo). A 'cancel subscription' button
> that opens a confirmation dialog listing what will be lost.
>
> Use light theme. Show inline validation errors next to each field (not a toast)."

**Key decisions the user SHOULD be asked:**

- Which tabs / sections are needed
- Fields per section (name + type + validation rule)
- Destructive actions requiring confirmation and their consequences
- Theme

**Key decisions the user SHOULD NOT need to make:**

- How `Form` integrates with React Hook Form / Zod
- How `Switch` controlled/uncontrolled state works with the form
- Whether to use `Dialog` or `AlertDialog` for confirmations
- How to tie an `Input`'s error message to the `Form` context
- Which `Button` variant to use for save vs. destructive actions
- How `Tabs` manages `value` / `onValueChange` vs. the form state

---

## What's currently missing

### In the plugin

| Gap                                       | Status                    | Covers                                                                                       |
| ----------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `new-app` skill                           | **Not built** — #122, #55 | Guided intake of tabbed settings description                                                 |
| Settings scaffold                         | **Not built** — #123, #55 | Generating typed form + tabs + confirmation dialog stubs                                     |
| Settings / portal playbook                | **Not built** — #83, #66  | "Settings App = Tabs + Form per tab + AlertDialog for destructive, wired like this"          |
| Field-description → component translation | **Not tracked**           | Mapping "password field with confirm + rules" → `Input type="password"` + validation pattern |
| Visual archetype preview                  | **Not built** — #57       | Showing the settings archetype before scaffold                                               |

### In the library / templates

| Gap                                                              | Status          | Detail                                                                                                                          |
| ---------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Settings template is shallow                                     | **Not tracked** | `registry/templates/settings/page.tsx` has a Tabs wrapper but only one stub tab with a single input — not representative        |
| Form + Tabs interaction undocumented                             | **Not tracked** | How to manage `isDirty` save-button state across tabbed forms is a common question; no recipe exists                            |
| Password validation pattern not provided                         | **Not tracked** | No example of an `Input type="password"` with live rule feedback (min length, special char, etc.) in the component library      |
| `AlertDialog` + destructive form submission pattern undocumented | **Not tracked** | "User clicks destructive button → AlertDialog opens → confirm → submit → spinner → done" is a multi-step pattern with no recipe |
| Active sessions table not in any template                        | **Not tracked** | A `DataTable` embedded inside a settings tab with per-row actions is a very common pattern with no example                      |

### Structural gaps being addressed by open issues

| Gap                                                               | Issue    | Detail                                                                                                                                         |
| ----------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Text/Heading primitives not in @qlik-coe-emea/qlabs-components-ui | **#188** | Settings pages need proper text hierarchy; currently developers improvise with Tailwind typography classes                                     |
| `StatusBadge` not unified                                         | **#189** | Five different badge implementations for status indicators — settings page plan badge / 2FA badge / session status all need the same component |
| Timeline moved from @qlik-coe-emea/qlabs-components-editor        | **#190** | `Timeline` is needed for settings change history; currently locked in the editor package                                                       |

### Blocking GitHub issues for this scenario end-to-end

- **#55 VP-02** — new-app skill + settings scaffold
- **#83 Playbooks** — settings composition recipe
- **#66 WP-09** — playbooks as agent skills
- **#188** — Text/Heading primitives (visual hierarchy in settings page)
- **#189** — StatusBadge (plan badge, 2FA status badge, session status)
- **#70 WP-13** — template quality (settings template is the shallowest of the five)
- **#57 VP-04** — visual archetype preview
