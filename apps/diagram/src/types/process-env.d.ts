// P4: library gap — packages/ui source reads process.env.NODE_ENV unguarded
// (command.tsx:376, context-rail.tsx:584); consumers that typecheck workspace
// source without @types/node fail. See apps/diagram/docs/findings/DG-01-ui-process-env.md.
declare const process: { env: Record<string, string | undefined> };
