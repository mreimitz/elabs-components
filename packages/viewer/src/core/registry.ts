/**
 * The adapter registry — how a file finds its renderer.
 *
 * Architecture adapted from [anyview](https://github.com/harshpreet931/anyview)
 * (MIT). Four properties are what make it work, and all four are deliberate:
 *
 * 1. **Eager manifests, lazy loaders.** Routing and capability questions are
 *    answered from plain data; the parser is fetched only when a file of that
 *    kind is actually opened.
 * 2. **Priority override.** A consumer replaces a built-in by registering a
 *    higher priority — no fork, no patch.
 * 3. **A fresh adapter per document.** The module (and its parser) is cached;
 *    the instance is not, so per-document state cannot leak between files.
 * 4. **A protocol guard.** A mismatched adapter fails with a named error at
 *    registration, not with an undefined property at render.
 */

import { type FileKind, resolveFileKind } from "@qlik-coe-emea/qlabs-components-ui";

import { ViewerError, isModuleNotFound, parserMissingError, toViewerError } from "./errors";
import {
  type AdapterLoader,
  type AdapterManifest,
  type AdapterModule,
  PROTOCOL_VERSION,
} from "./types";

/**
 * How specifically a manifest claimed a file. Higher is more specific.
 * A plain object rather than a `const enum` — the repo builds with
 * `isolatedModules`, which cannot inline one.
 */
const MatchScore = {
  None: 0,
  Category: 1,
  MediaTypePrefix: 2,
  MediaType: 3,
  Extension: 4,
} as const;

type MatchScore = (typeof MatchScore)[keyof typeof MatchScore];

interface Entry {
  manifest: AdapterManifest;
  loader: AdapterLoader;
}

/** A registry of file adapters. Create with {@link createRegistry}. */
export interface ViewerRegistry {
  /**
   * Add an adapter, or replace one with the same `id`.
   *
   * Replacement is by id and unconditional — the caller asked for it. Priority
   * governs which of several DIFFERENT adapters wins a file, not whether a
   * registration takes effect.
   *
   * @throws {ViewerError} `protocol-mismatch` if the manifest targets another protocol.
   */
  register(manifest: AdapterManifest, loader: AdapterLoader): void;
  /**
   * Every registered manifest, highest priority first. Not the routing order —
   * specificity is per-file, so only {@link detect} can rank for a given file.
   */
  manifests(): AdapterManifest[];
  /** The manifest that should open this file, or `undefined` if none claims it. */
  detect(kind: FileKind): AdapterManifest | undefined;
  /** Convenience over {@link detect} for a name + MIME. */
  detectByName(name: string, mediaType?: string): AdapterManifest | undefined;
  /**
   * Fetch an adapter module by id, caching the MODULE (never an instance).
   *
   * @throws {ViewerError} `unsupported-format` when the id is unknown,
   * `parser-missing` when the module's optional peer is not installed,
   * `protocol-mismatch` when the loaded module disagrees with its manifest.
   */
  load(id: string): Promise<AdapterModule>;
}

/** How well `manifest` claims `kind`. `MatchScore.None` means "not mine". */
export function scoreManifest(manifest: AdapterManifest, kind: FileKind): MatchScore {
  if (kind.extension && manifest.extensions?.includes(kind.extension)) {
    return MatchScore.Extension;
  }
  for (const declared of manifest.mediaTypes ?? []) {
    if (declared.endsWith("/")) {
      if (kind.mediaType.startsWith(declared)) return MatchScore.MediaTypePrefix;
    } else if (declared === kind.mediaType) {
      return MatchScore.MediaType;
    }
  }
  if (manifest.categories?.includes(kind.category)) return MatchScore.Category;
  return MatchScore.None;
}

/** Unwrap `export default` vs named exports, so an adapter can use either. */
function unwrap(loaded: AdapterModule | { default: AdapterModule }): AdapterModule {
  return "default" in loaded && loaded.default ? loaded.default : (loaded as AdapterModule);
}

function assertProtocol(manifest: AdapterManifest, where: string): void {
  if (manifest.protocol !== PROTOCOL_VERSION) {
    throw new ViewerError(
      "protocol-mismatch",
      `Adapter "${manifest.id}" targets viewer protocol ${String(manifest.protocol)}, but this build speaks ${String(PROTOCOL_VERSION)} (${where}).`,
    );
  }
}

/**
 * Create an empty registry.
 *
 * Empty on purpose: the built-ins live in `createDefaultRegistry()`
 * (`src/adapters`), so a consumer who wants only their own adapters — or only
 * images — never pulls in the rest.
 */
export function createRegistry(): ViewerRegistry {
  const entries = new Map<string, Entry>();
  const modules = new Map<string, Promise<AdapterModule>>();

  function ordered(): Entry[] {
    return [...entries.values()].sort(
      (a, b) => (b.manifest.priority ?? 0) - (a.manifest.priority ?? 0),
    );
  }

  function detect(kind: FileKind): AdapterManifest | undefined {
    let best: { manifest: AdapterManifest; score: MatchScore; priority: number } | undefined;
    for (const { manifest } of entries.values()) {
      const score = scoreManifest(manifest, kind);
      if (score === MatchScore.None) continue;
      const priority = manifest.priority ?? 0;
      // Priority is the consumer's explicit override, so it outranks how
      // specifically an adapter happened to claim the file.
      const wins =
        !best || priority > best.priority || (priority === best.priority && score > best.score);
      if (wins) best = { manifest, score, priority };
    }
    return best?.manifest;
  }

  return {
    register(manifest, loader) {
      assertProtocol(manifest, "registration");
      entries.set(manifest.id, { manifest, loader });
      // A replaced id must not keep serving the old module.
      modules.delete(manifest.id);
    },

    manifests() {
      return ordered().map((entry) => entry.manifest);
    },

    detect,

    detectByName(name, mediaType) {
      return detect(resolveFileKind(name, mediaType));
    },

    async load(id) {
      const entry = entries.get(id);
      if (!entry) {
        throw new ViewerError("unsupported-format", `No adapter is registered for "${id}".`);
      }

      let pending = modules.get(id);
      if (!pending) {
        pending = entry
          .loader()
          .then((loaded) => {
            const adapterModule = unwrap(loaded);
            assertProtocol(adapterModule.manifest, `module "${id}"`);
            return adapterModule;
          })
          .catch((error: unknown) => {
            // Not cached: an optional peer installed later, or a transient
            // chunk-load failure, must be retryable without a page reload.
            modules.delete(id);
            if (isModuleNotFound(error)) {
              throw parserMissingError(id, entry.manifest.requires ?? [], { cause: error });
            }
            throw toViewerError(error, "parse-failed");
          });
        modules.set(id, pending);
      }
      return pending;
    },
  };
}
