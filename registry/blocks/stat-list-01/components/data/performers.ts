export interface Performer {
  initials: string;
  name: string;
  role: string;
  value: string;
  tone: "success" | "destructive";
}

export const PERFORMERS: Performer[] = [
  { initials: "JD", name: "Johnathan Doe", role: "Top sales", value: "+68", tone: "success" },
  { initials: "FW", name: "Footware", role: "Best seller", value: "+12", tone: "success" },
  {
    initials: "FS",
    name: "Fashionware",
    role: "Most commented",
    value: "-36",
    tone: "destructive",
  },
];
