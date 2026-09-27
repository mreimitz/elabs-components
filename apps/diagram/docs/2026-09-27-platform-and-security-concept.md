# Atlas as a shared vendor platform — sharing, ownership, protection, security

Date: 2026-09-27 · Trigger: the maintainer's direction that Atlas is **centrally deployed per vendor**, users share diagrams, make them public and reusable, and an owner (e.g. the PM of Qlik Answers) can make a diagram reusable **without** letting anyone change its architecture, while a presales blends it into a customer story · Status: concept + questions · Supersedes the "single user, no backend, not deployed" framing of `2026-09-27-atlas-v2-plan.md` §9.1 and V5 (the design stays; the deployment target changes)

## 1. The three roles in one sentence

> The **PM** publishes the truth about a product as a protected component; the **presales** composes customer stories from protected components plus their own context; the **customer** receives a published, read-only, interactive picture.

Everything below serves that sentence.

## 2. What changes, what stays

| Stays (already designed)                                                               | Changes                                                                                                 |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| YAML is the source of truth; diagrams and components are files                         | Files live in a **server-side workspace** per vendor deployment, not in the maintainer's repo           |
| `use:` references are **live and read-only** (V2) — this _is_ the protection primitive | Add **who may reference** (visibility) and **what an instance may add** (extension points)              |
| Composition: primitives → components → diagrams                                        | Components get an **owner**, a **lifecycle** (draft → published → deprecated) and **released versions** |
| Theme = hero + default profiles (S1)                                                   | The **deployment** picks the theme: a Qlik instance is Qlik-hero for everyone                           |
| MCP server                                                                             | Per-user authentication (OAuth 2.1 per the MCP spec), permissions enforced server-side                  |
| Dev middleware `/api/workspace/*`, `/api/styles/*`, `/api/catalog/*`, `/mcp`           | The same API served by a real **Atlas server**; the web app does not change its calls                   |
| Publish as self-contained HTML (gap review G1)                                         | Plus **hosted publishing**: a share link on the instance, optionally public                             |

## 3. Domain model

```
Deployment (one per vendor: atlas.qlik.example)   theme/hero · IdP · admins · catalog · profiles
└── Users (from the vendor's IdP)                   roles: viewer · author · publisher · admin
    └── Spaces                                      personal · team · shared (org) · public
        └── Documents: diagrams, components         owner · collaborators · visibility · lifecycle · versions
            ├── Instances (`use:`) of components    read-only; limited overrides; extension points
            ├── Comments, stories, thumbnails
            └── Published artefacts                 hosted share links, interactive HTML, PPTX, PNG/SVG
```

### 3.1 Spaces and visibility

- **Personal** — the user's drafts; nobody else sees them.
- **Team** — a named group (Presales DACH, PM Answers); members edit per role.
- **Shared (org)** — every authenticated user of the deployment may view and reference; editing per document.
- **Public** — readable by anyone with the link, including customers; referencing still requires an account (a public diagram can be _viewed_ anonymously, not _used_ anonymously).

A document's visibility is explicit and shown as a chip everywhere (Home, tree, top bar, share dialog). Visibility of a diagram can never exceed the visibility of the components it uses — the server refuses "make public" while it references a team-only component, and says which one.

### 3.2 Roles on a document

| Role          | Can                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| **Owner**     | everything; transfer ownership; set visibility, protection and extension points; publish releases; delete |
| **Editor**    | edit content; cannot change protection, visibility, ownership                                             |
| **Commenter** | view + comment                                                                                            |
| **Viewer**    | view, present, export (if the owner allows export); reference (`use:`) if visibility allows               |

Deployment roles on top: **admin** (users, teams, catalog, profiles, retention), **publisher** (may set _public_), **author** (may create), **viewer**.

### 3.3 Protection — "reusable, but you may not change my architecture"

Protection is a property of a **component** set by its owner. Because references are already read-only, the question is only _what an instance may do around it_:

```yaml
# components/qlik-answers.yaml (owned by the Answers PM)
component:
  icon: qlik/answers
  description: Qlik Answers — the standard architecture
  protection: locked # locked | extendable | open
  extensionPoints: # the only places an instance may attach things (extendable/locked)
    - {
        id: sources,
        title: Knowledge sources,
        accepts: [datastore, external, service],
        side: left,
        max: 6,
      }
    - { id: consumers, title: Consumers, accepts: [actor, service], side: right }
  instanceMay: [title, expand, position, story, notes] # overrides an instance may set; nothing else
  releases: { policy: follow-latest } # or pinned — what consumers get by default
```

| Protection   | An instance may…                                                                                                   | Typical owner           |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `locked`     | reference it; attach its own nodes/flows **only at extension points**; set `instanceMay` overrides; nothing inside | PM of a product         |
| `extendable` | as locked, plus add flows to any inner node (dotted ids) — but never add/remove/rename inner nodes                 | reference architectures |
| `open`       | anything (a template: **fork** creates an owned copy with `origin:` recorded)                                      | examples, starter kits  |

The **presales' customer story** is therefore: `use: components/qlik-answers` (locked), customer sources attached to the `sources` extension point, the customer's SSO attached to `consumers`, the customer's zones around it, a story of their own. The Answers architecture inside stays the PM's; when the PM publishes a new release it flows into every story (the maintainer's rule) — see 3.4 for how that stays safe.

**Fork** exists for the honest case where a presales needs a different architecture: it copies the component into their space with `origin: components/qlik-answers@1.4`, marks it _derived_ (a chip on the canvas: "derived from Qlik Answers 1.4 — not the official architecture"), and Home's health lists derived copies for the owner to see. Protection cannot be bypassed by editing YAML: the server validates every write against the referenced components' rules (the validator rejects flows into a locked component outside its extension points with a clear issue).

### 3.4 Lifecycle and releases

- Documents have a lifecycle: **draft → published → deprecated**. Only published components can be referenced from outside the owner's space (drafts are invisible there).
- Publishing a component creates a **release** (`1.4`, with a summary line). Consumers on `follow-latest` get it automatically (the maintainer's rule: change the component, every diagram changes) — but the owner decides _when_ by publishing, so half-finished edits never leak into a customer deck. `pinned` is available for a presales who must freeze a story for a signed proposal (`use: components/qlik-answers@1.3`).
- Deprecating a component keeps existing references working, shows a "deprecated → use X" hint in the details card and Home's health tile, and blocks new references.
- A diagram's **versions** come from the server's history (Git-backed store or a versions table): restore, compare (gap review G2's diff), changelog.

### 3.5 Sharing and publishing

- **Share link** (hosted): `atlas.qlik.example/d/<id>` for authenticated users per visibility; **public links** for `public` documents, optionally with an expiry and a "customer-safe" flag (hides internal notes/metrics, G9).
- **Interactive HTML export** (G1) stays for offline/mail — it embeds exactly what the viewer may see; export permission is per document (`allowExport`).
- **Embed** (`<iframe>`) for the vendor's docs/web team from public documents.
- **Catalog and profiles** are deployment-wide: admins/publishers curate them; everyone reads them; a user may propose a part (draft) for review.

### 3.6 Identity and the MCP server

- **Authentication:** the vendor's IdP via OIDC (Entra ID for Microsoft, Okta/Entra for Qlik, Google for GCP shops); no local passwords. Optional **customer guest** accounts for reviewing a shared diagram with comments (invited by link, scoped to that document).
- **MCP:** OAuth 2.1 authorization as the MCP spec describes (the client obtains a token for the user; the server enforces the user's permissions on every tool). A Claude session therefore can only create in the user's spaces, only reference what the user may reference, and never edits a locked component. Personal access tokens for CLI automation, revocable.
- **Audit:** every publish, visibility change, protection change, fork, export and public link creation is logged with user, time, document, version.

## 4. Security concept (the checklist for the deployment)

| Area            | Rule                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenancy         | One deployment per vendor; no cross-vendor data; the vendor's theme/hero is a deployment setting                                                                                                         |
| AuthN           | OIDC only; sessions as httpOnly, SameSite cookies; MFA is the IdP's job; guest accounts scoped to one document with expiry                                                                               |
| AuthZ           | Server-side, on every read and write, at document + space level; the web app only _hides_, the server _refuses_; "make public" checks the reference closure; protection validated on write               |
| Content         | Uploaded logos: SVG sanitised (no scripts, no external refs), size limits; YAML size limits; no code in the dialect (already a rule); Markdown rendered without raw HTML                                 |
| Publishing      | Public links are unguessable ids, revocable, optionally expiring; "customer-safe" strips internal fields; exports embed only what the exporter may see                                                   |
| Secrets         | The app holds no model keys (V14); IdP client secrets and DB credentials in the server's environment only                                                                                                |
| Transport & CSP | HTTPS only; strict CSP (self + the deployment's own asset host; no inline scripts except the published-HTML bundle, which is generated with hashes); no third-party fonts at runtime (Inter self-hosted) |
| Data            | Retention policy per space (personal drafts purge after N days of deletion; trash with restore); export of a user's own data; deletion on offboarding transfers or trashes owned documents               |
| MCP             | OAuth 2.1, per-user tokens, rate limits per token, tool calls audited; the render bridge only to the user's own open tab                                                                                 |
| Supply chain    | The published-HTML viewer is a pinned, built bundle; the icon packs are vendored (already); dependency audit in the server's CI                                                                          |
| Ops             | Container image per release; health endpoint; backups of the store; log without document content                                                                                                         |

## 5. Architecture — from local tool to platform without a rewrite

```
today   apps/diagram  ──  Vite dev middleware  (files in apps/diagram/workspace, no auth)
later   apps/diagram  ──  atlas-server (Node)  ──  store adapter: git-backed files | Postgres  ──  IdP (OIDC)
                                             └──  /mcp (OAuth 2.1)   └──  object storage for thumbnails/logos/exports
```

- **The web app calls one API contract** (`/api/workspace|styles|catalog|comments|publish`, `/mcp`). DG-21 implements it as a dev middleware; the server implements the same contract with auth and permissions. The app gains a `session` (who am I, my roles) and permission-aware UI (disabled actions with a reason), nothing else structural.
- **Store adapter:** start Git-backed (a bare repo per deployment: every save a commit by the user — versions, diff and audit for free; simple to back up), move to Postgres + object storage when concurrency demands it. The adapter interface is fixed now so the choice can change later.
- **Deployment:** one Docker image (server + built web app + published-HTML viewer bundle), configured by environment (`ATLAS_THEME=qlik`, `OIDC_*`, store URL). Runs on the vendor's own infrastructure or a managed host; per-vendor, no shared instance.
- **Library implications (P4):** none new — the app stays a consumer; the viewer bundle is a candidate registry block later.

## 6. Experience changes

- **Home** gains _My drafts · Shared with me · Team · Public_, an "Owned by me" filter, and the health tiles the PM needs (derived copies, deprecated in use, visibility conflicts).
- **Share dialog** on every diagram: visibility, people/teams with roles, public link with expiry and customer-safe, export permission, embed code.
- **Component page** (owner view): protection, extension points editor (drag a port onto the composite's border), releases with summaries, "used in N diagrams across M users", deprecate → suggest replacement.
- **Canvas:** a locked composite shows a small lock chip and its extension points as labelled sockets; dropping a node on a socket attaches it; dropping anywhere else on the composite is refused with the reason ("Qlik Answers is locked by <owner> — attach at Knowledge sources or Consumers").
- **Inspector:** protection state and "request a change" (opens a comment thread addressed to the owner).
- **Present/publish:** the customer-safe toggle, public link, guest invite.

## 7. What this does to the plan

- **DG-21 (workspace service)** keeps its scope but its API becomes the contract; add `session` and `permissions` endpoints (stubbed as "single admin user" locally) so the UI can be built permission-aware from day one.
- **DG-26 (composition)** adds `protection`, `extensionPoints`, `instanceMay`, releases/pins and the write-time validation of protection rules.
- **DG-27 (composites)** renders lock chips and sockets; drag-to-socket.
- **New DG-56 — Sharing & permissions UI**: spaces, share dialog, visibility chips, permission-aware actions, guest review (server stubbed locally).
- **New DG-57 — Atlas server**: the Node server implementing the contract with OIDC, OAuth 2.1 for MCP, Git-backed store adapter, audit log, public links, container image. This is the first item that lives **outside** `apps/diagram`'s "not deployed" rule — it needs your explicit go and a home (`apps/atlas-server`? a separate repo?).
- **New DG-58 — Hosted publishing**: share links, public pages, embed, the viewer bundle served by the server; ties to DG-43 (interactive HTML).
- The persona gap review's G1/G6/G7 items become part of this track.

## 7a. Invariant: local mode always works (maintainer, 2026-09-27)

`pnpm --filter @elabs-ai/diagram dev` on the maintainer's machine must keep working exactly as today, through every platform item and after:

- **No server, no login, no network needed.** The Vite dev middleware stays the local implementation of the API contract; the session is a built-in single admin user; every permission is granted; visibility and protection are still _rendered_ (so the UI can be built) but nothing is refused locally except what the validator refuses anyway.
- **Files stay files.** `apps/diagram/workspace/` on disk remains the store in local mode; the Git-backed server store reads the same layout, so a workspace folder can be copied into a deployment and back.
- **One switch.** The web app picks its mode from one setting (`VITE_ATLAS_MODE=local|server`, default `local`); no code path may assume the server exists.
- **Gate.** Every platform item (DG-56…58) and every wave gate includes a **local-mode smoke**: start the dev server from a clean checkout, open Home, open a diagram, edit, switch lens, present, export — all without any server or credentials.

## 8. Decisions (maintainer, 2026-09-27)

| #   | Decision                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Build the Atlas server, in this monorepo at `apps/atlas-server`.** It shares the React-free spec code with the app. It is the first deliverable outside `apps/diagram`'s "not deployed" rule; the same off-CI conventions apply until it has its own gates. |
| P2  | **Identity: generic OIDC, Entra ID first.** No local passwords.                                                                                                                                                                                               |
| P3  | **Store: Git-backed files first, Postgres later**; the store adapter interface is fixed in DG-21 so the switch stays contained.                                                                                                                               |
| P4  | **Protection default `locked`** for a newly published component; owners open up deliberately.                                                                                                                                                                 |
| P5  | **Propagation on publish:** a component's saves are private until the owner publishes a release; `follow-latest` consumers then update; `@version` pinning available.                                                                                         |
| P6  | **Sharing scope, phased:** phase 1 = **org-wide** (personal · team · shared); **external sharing comes later** as phase 2 = public links + **guest review accounts scoped to one diagram**. No anonymous access in phase 1.                                   |
| P7  | **Timing:** the server track starts **after wave 2 (composition)**; the API contract is frozen now in DG-21 so nothing built locally is thrown away.                                                                                                          |
| P9  | **Local mode always works** (§7a): no server, no login, no network; files on disk; one mode switch; a local-mode smoke in every platform gate.                                                                                                                |
| P8  | Sections 3–6 stand as designed; "Public" in §3.1 is phase 2.                                                                                                                                                                                                  |
