// Next's ambient types, referenced here instead of through the generated next-env.d.ts so
// `tsc --noEmit` runs before any build and never writes .next/ (which the root Prettier run
// would then scan).
/// <reference types="next" />
/// <reference types="next/image-types/global" />
