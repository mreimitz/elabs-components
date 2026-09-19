---
"@elabs-ai/components-ai": patch
---

`Persona` no longer freezes the browser tab in a React development build. Once the Rive artwork loaded, an internal component received the Rive instance as a prop, and React 19.2's development-only performance logging walked that object on every re-render until the tab ran out of memory (about 4.6 GB, then the page crashed). The view-model hooks now run inside `Persona`'s Rive layer, so the instance never passes through props. Artwork, state inputs and the light/dark ink of the dynamic-colour variants behave as before. Production builds do not run that logging.
