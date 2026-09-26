import { useEffect, useState } from "react";

/**
 * The live `location.hash`. The app's dev routes (`#icons`, `#nodes`, `#zones`, `#edges`)
 * switch on it in `app.tsx`; no router dependency is warranted for a handful of
 * galleries. Added by DG-04, shared by every gallery since.
 */
export function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return hash;
}
