import { createIcon } from "../icon";

const BOOKMARK_PATH = "M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z";

export const BookmarkIcon = createIcon(
  <>
    <path d={BOOKMARK_PATH} />
  </>,
  "BookmarkIcon",
  {
    // Same silhouette, filled instead of stroked — the closed outline path
    // already describes the solid shape, so no separate geometry is needed.
    solid: <path d={BOOKMARK_PATH} />,
  },
);
