import technical from "./profiles/atlas-clean.yaml?raw";
import visual from "./profiles/qlik-marketecture.yaml?raw";
import { loadProfiles } from "./load-profiles";
const loaded = loadProfiles(
  new Map([
    ["atlas-clean", technical],
    ["qlik-marketecture", visual],
  ]),
);
if (loaded.issues.length)
  throw new Error(
    `Invalid bundled styles: ${loaded.issues.map((issue) => issue.message).join(" ")}`,
  );
export const BUILTIN_PROFILES = loaded.profiles;
