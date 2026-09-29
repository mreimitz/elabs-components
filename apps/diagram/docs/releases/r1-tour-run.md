# R1 maintainer tour

Automated engineering verification passed all twelve [demo steps](../demo-script.md) on fbcb4df557ff9e20597cedaa94044f4814cef67e.

- [Main tour](r1-tour.webm): 109.6 seconds, 11,552,699 bytes. Includes the actual offline HTML.
- [Persisted reopen](r1-tour-reopen.webm): 8.9 seconds, 844,833 bytes.

Browser: Chromium 148.0.7778.96; 1440 × 900, Qlik light, normal motion. No external network requests or browser exceptions occurred. Template and referenced component hashes stayed unchanged. The test customer copy was removed after its saved contents were verified.

Reproduce on an isolated dev server with `DIAGRAM_URL=http://127.0.0.1:5446 node tests/r1-demo-tour.mjs` from apps/diagram; see [the test harness](../../tests/r1-demo-tour.mjs). Evidence includes per-step screenshots, JSON results and the downloaded HTML. This is automated engineering verification, not proof of real-deal adoption or written owner acceptance. Phase B onboarding remains outside this tour.
