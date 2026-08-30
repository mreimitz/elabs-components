export type { IllustrationProps } from "./illustration-base";
// The custom-property name a consumer sets to safely retint an illustration's
// meaning-bearing accent (see `StatePanel`'s own usage). Previously only the
// illustration components + `IllustrationProps` were exported here, so a
// consumer rendering an illustration OUTSIDE `StatePanel` had no way to reach
// this seam without duplicating the private string (#12/#53 review, P2).
// Relates to the wider "illustration customization" tracking issue #46 — this
// change exports the existing constant, it does not itself resolve #46.
export { ILLUSTRATION_ACCENT_VAR } from "./illustration-base";
export { EmptyListIllustration } from "./empty-list-illustration";
export { NoResultsIllustration } from "./no-results-illustration";
export { NoAccessIllustration } from "./no-access-illustration";
export { ErrorIllustration } from "./error-illustration";
export { OfflineIllustration } from "./offline-illustration";
export { SuccessIllustration } from "./success-illustration";
export { FirstRunIllustration } from "./first-run-illustration";
