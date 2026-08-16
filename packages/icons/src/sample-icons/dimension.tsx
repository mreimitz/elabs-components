import { createIcon } from "../icon";

export const DimensionIcon = createIcon(
  <>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <path d="M13 17h4M15 15v4" />
  </>,
  "DimensionIcon",
);
