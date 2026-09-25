import { seeded } from "@/components/grid-parts/grid-kit";

export type EntryStatus = "Draft" | "In review" | "Approved" | "Posted";
export const ENTRY_STATUSES: readonly EntryStatus[] = ["Draft", "In review", "Approved", "Posted"];

export interface JournalEntry {
  id: string;
  /** ISO day, September 2026. */
  date: string;
  account: string;
  entity: string;
  type: "Accrual" | "Reclass" | "Prepaid" | "Depreciation" | "FX revaluation";
  /** Debit positive, credit negative. */
  amount: number;
  preparer: string;
  status: EntryStatus;
  memo: string;
}

const ACCOUNTS: [string, JournalEntry["type"][], string][] = [
  ["2100 Accrued expenses", ["Accrual"], "Unbilled"],
  ["1400 Prepaid expenses", ["Prepaid"], "Amortise"],
  ["1600 Fixed assets", ["Depreciation"], "Monthly depreciation"],
  ["6100 Cloud hosting", ["Accrual", "Reclass"], "Hosting"],
  ["6200 Software subscriptions", ["Prepaid", "Reclass"], "Licences"],
  ["6400 Professional fees", ["Accrual"], "Audit and legal"],
  ["7900 FX gain / loss", ["FX revaluation"], "Month-end revaluation"],
];
const ENTITIES = ["Acme GmbH", "Acme Ltd", "Acme Inc."];
const PREPARERS = ["Jana Horak", "Luis Ortega", "Mina Sato", "Owen Price"];
const VENDORS = ["AWS", "Datadog", "Figma", "KPMG", "Baker & Co", "Atlassian", "Salesforce"];

export function makeJournal(count = 64): JournalEntry[] {
  const rnd = seeded(73);
  return Array.from({ length: count }, (_, i) => {
    const [account, types, label] = rnd.pick(ACCOUNTS);
    const type = rnd.pick(types);
    const magnitude = rnd.int(8, 240) * 250;
    const status = rnd.weighted<EntryStatus>([
      ["Posted", 5],
      ["Approved", 3],
      ["In review", 3],
      ["Draft", 2],
    ]);
    return {
      id: `JE-${String(4120 + i)}`,
      date: `2026-09-${String(rnd.int(22, 30)).padStart(2, "0")}`,
      account,
      entity: rnd.pick(ENTITIES),
      type,
      amount: type === "FX revaluation" && rnd.next() < 0.5 ? -magnitude : magnitude,
      preparer: rnd.pick(PREPARERS),
      status,
      memo:
        type === "Depreciation" || type === "FX revaluation"
          ? `${label}, September`
          : `${label} — ${rnd.pick(VENDORS)}, September`,
    };
  });
}
