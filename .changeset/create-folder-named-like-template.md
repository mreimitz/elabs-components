---
"@elabs-ai/components-cli": patch
---

`create` no longer prints its usage when the folder has the same name as the template, theme or title (`brand-ui create dashboard --template dashboard`). It now writes the app into that folder.
