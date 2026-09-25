let s = 42;
const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
const pick = (a) => a[Math.floor(r() * a.length)];
const countries = [
  "Austria",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Sweden",
  "Poland",
  "Japan",
  "Brazil",
  "Canada",
  "India",
  "Kenya",
];
const cats = ["Hardware", "Software", "Services", "Support", "Training", "Cloud", "Data"];
const status = ["Open", "Won", "Lost", "Pending", "Stalled"];
const words = [
  "alpha",
  "bravo",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
  "india",
  "kilo",
  "lima",
  "mike",
  "nova",
  "oscar",
  "papa",
];
export const COLS = [
  "id",
  "name",
  "company",
  "country",
  "category",
  "status",
  "date",
  "m1",
  "m2",
  "m3",
  "m4",
  "m5",
  "m6",
  "m7",
  "m8",
  "m9",
  "m10",
  "ratio",
  "active",
  "notes",
];
export function makeRows(n) {
  s = 42;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const o = {
      id: i + 1,
      name: pick(words) + " " + pick(words),
      company: pick(words).toUpperCase() + " GmbH",
      country: pick(countries),
      category: pick(cats),
      status: pick(status),
      date: new Date(2020, 0, 1 + Math.floor(r() * 2000)).toISOString().slice(0, 10),
    };
    for (let k = 1; k <= 10; k++) o["m" + k] = Math.round(r() * 1e6) / 100;
    o.ratio = Math.round(r() * 1000) / 1000;
    o.active = r() > 0.5;
    o.notes = pick(words) + " " + pick(words) + " " + pick(words);
    out[i] = o;
  }
  return out;
}
export const params = new URLSearchParams(location.search);
export const N = Number(params.get("rows") || 10000);
