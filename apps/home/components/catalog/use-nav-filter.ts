"use client";
/**
 * The rail's filter box, shared by the site shell and the catalogue sidebar: matches a page's
 * name, its family and its summary. The summaries are not in the nav cut the shell ships at
 * first paint — the first keystroke fetches the search text as its own chunk
 * (`loadCatalogIndex`), and until it lands the filter matches names and families alone.
 */
import { useEffect, useMemo, useState } from "react";
import { hrefOf, loadCatalogIndex } from "../../lib/catalog-nav";
import type { NavBranch } from "./nav-model";

let summariesByHref: Map<string, string> | null = null;
let pending: Promise<Map<string, string>> | null = null;

const loadSummaries = () =>
  (pending ??= loadCatalogIndex().then((index) => {
    summariesByHref = new Map(
      index.map((entry) => [hrefOf(entry), `${entry.summary} ${entry.question}`.toLowerCase()]),
    );
    return summariesByHref;
  }));

export function useNavFilter(branches: NavBranch[], filter: string): NavBranch[] {
  const needle = filter.trim().toLowerCase();
  const [summaries, setSummaries] = useState(summariesByHref);
  useEffect(() => {
    if (!needle || summaries) return;
    let live = true;
    void loadSummaries().then((map) => {
      if (live) setSummaries(map);
    });
    return () => {
      live = false;
    };
  }, [needle, summaries]);
  return useMemo(() => {
    if (!needle) return branches;
    return branches
      .map((branch) => ({
        ...branch,
        groups: branch.groups
          .map((group) => ({
            ...group,
            leaves: group.leaves.filter(
              (item) =>
                item.name.toLowerCase().includes(needle) ||
                group.label.toLowerCase().includes(needle) ||
                (summaries?.get(item.href)?.includes(needle) ?? false),
            ),
          }))
          .filter((group) => group.leaves.length > 0),
      }))
      .filter((branch) => branch.groups.length > 0);
  }, [branches, needle, summaries]);
}
