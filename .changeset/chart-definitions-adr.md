---
---

No package changes. The repository now documents how chart props will be unified over the next minor releases: every chart gets one definition built from shared prop groups, and a fixed list of props gets new names. Each old name keeps working, with a one-time warning in development, until 6.0.0. The full list is in `docs/ADR/0042-chart-definitions-and-prop-groups.md`.
