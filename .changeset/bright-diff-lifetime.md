---
"@elabs-ai/components-editor": patch
---

Cancel the diff editor's owned view model before releasing its text models, preventing pending diff work from failing during rapid preview closure.
