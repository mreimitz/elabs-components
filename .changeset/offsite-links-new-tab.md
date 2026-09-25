---
"@elabs-ai/components-ui": patch
"@elabs-ai/components-marketing": patch
---

Links that leave the page now open in a new tab, with `rel="noopener noreferrer"`. `SurfaceTourActions` opens its "Open in Storybook" link in a new tab. `TrustStrip` facts and `IntegrationMatrix` link actions do the same when their `href` is an http(s) address, the rule `ProseLink` already follows. An on-site path such as `/docs` still opens in place.
