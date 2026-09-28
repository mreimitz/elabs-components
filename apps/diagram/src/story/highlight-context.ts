import { createContext } from "react";
/** Canvas-local: a parent story cannot dim a referenced child or the inert shared picture. */
export const StoryHighlightContext = createContext<ReadonlySet<string> | null>(null);
