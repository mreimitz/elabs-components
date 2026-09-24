/**
 * A fictional show with six episodes. Each recording is a short silent clip
 * synthesized by `media-parts` so the block plays offline; the chapters and
 * transcript are timed to those clip lengths. Point `src` and `cover` at your
 * own files (and time `chapters` / `transcript` from your show notes) when you
 * copy it.
 */
import { coverArt, silentClip, type PosterMotif } from "@/components/media-parts/media-fixtures";

export interface Chapter {
  /** Start, in seconds. */
  at: number;
  title: string;
}

export interface TranscriptCue {
  /** Start, in seconds. */
  at: number;
  speaker: string;
  text: string;
}

export interface Episode {
  id: string;
  number: number;
  title: string;
  summary: string;
  published: string;
  /** Length in seconds — the list and the player format it. */
  seconds: number;
  /** The recording (any URL the browser can play). */
  src: string;
  /** Square cover art, shown as the player's stage. */
  cover: string;
  guests: string[];
  chapters: Chapter[];
  transcript: TranscriptCue[];
}

export interface Show {
  name: string;
  tagline: string;
  hosts: string;
  episodes: Episode[];
}

/** Spread `chapters` and `transcript` over `seconds` from their share of the runtime. */
function episode(
  base: Omit<Episode, "src" | "cover" | "chapters" | "transcript"> & {
    motif: PosterMotif;
    chapters: string[];
    transcript: [speaker: string, text: string][];
  },
): Episode {
  const { motif, chapters, transcript, ...rest } = base;
  const chapterStep = rest.seconds / chapters.length;
  const cueStep = rest.seconds / transcript.length;
  return {
    ...rest,
    src: silentClip(rest.seconds),
    cover: coverArt(motif, rest.id),
    chapters: chapters.map((title, i) => ({ at: Math.round(i * chapterStep), title })),
    transcript: transcript.map(([speaker, text], i) => ({
      at: Math.round(i * cueStep * 10) / 10,
      speaker,
      text,
    })),
  };
}

export const SHOW: Show = {
  name: "On the Dock",
  tagline:
    "Conversations with the people who run operations — and the software that keeps up with them.",
  hosts: "Hosted by Mara Quist",
  episodes: [
    episode({
      id: "ep-24",
      number: 24,
      title: "What a queue knows that a dashboard doesn’t",
      summary:
        "Ingrid Solberg on turning four ports of shipment data into one list of things to do today — and why the desk stopped reading the weekly report.",
      published: "16 Sep 2026",
      seconds: 16,
      guests: ["Ingrid Solberg"],
      motif: "harbour",
      chapters: [
        "Cold open",
        "The 31-hour problem",
        "Cost of delay as a sort order",
        "What changed for the yard",
      ],
      transcript: [
        [
          "Mara",
          "Ingrid, you told me the desk had plenty of data and still couldn’t answer one question.",
        ],
        [
          "Ingrid",
          "Which containers need a person today. Everything else was a report about last week.",
        ],
        ["Mara", "So the fix wasn’t more data."],
        [
          "Ingrid",
          "It was one list, ordered by what a day of delay costs us. The list is the product.",
        ],
        ["Mara", "And the yard?"],
        ["Ingrid", "The yard stopped keeping its own list. That was the moment we knew."],
        ["Mara", "Nineteen hours, from thirty-one."],
        ["Ingrid", "And it held. That’s the part I care about."],
      ],
    }),
    episode({
      id: "ep-23",
      number: 23,
      title: "Approval gates, and where a person should step in",
      summary:
        "Tomas Pereira on agents that propose the fix and people who approve it — the audit trail that made the compliance team relax.",
      published: "2 Sep 2026",
      seconds: 14,
      guests: ["Tomas Pereira"],
      motif: "orbit",
      chapters: ["Intro", "The expensive path", "Designing the gate", "What the auditors asked"],
      transcript: [
        ["Mara", "Tomas, ‘humans on the expensive path’ — that’s your phrase."],
        [
          "Tomas",
          "If a decision moves a vessel, a person signs it. Everything cheaper, the agent can propose and do.",
        ],
        ["Mara", "How do you know where the line is?"],
        [
          "Tomas",
          "You draw it too low, and move it up when the trail shows the agent was right ten times in a row.",
        ],
        ["Mara", "And the auditors?"],
        [
          "Tomas",
          "They asked for the trail, read it, and stopped asking. It was the easiest audit we’ve had.",
        ],
        ["Mara", "That’s a rare sentence."],
      ],
    }),
    episode({
      id: "ep-22",
      number: 22,
      title: "Migrating off spreadsheets without a big bang",
      summary:
        "Two teams, one quarter: what to keep, what to model, and the tab nobody was allowed to delete.",
      published: "19 Aug 2026",
      seconds: 12,
      guests: ["Dr. Marta Lind", "Aiko Mori"],
      motif: "grid",
      chapters: [
        "Intro",
        "The tab nobody could delete",
        "Modelling what mattered",
        "Tuesday to Friday",
      ],
      transcript: [
        ["Mara", "Marta, you replaced three tools and a wall of spreadsheets."],
        [
          "Marta",
          "Two of the tools nobody missed. The spreadsheets were harder — they held the tribal knowledge.",
        ],
        [
          "Aiko",
          "We set up on a Tuesday and were planning live routes by Friday. The trick was not migrating everything.",
        ],
        ["Mara", "What did you leave behind?"],
        ["Marta", "Anything nobody could explain. If a column had no owner, it didn’t come."],
        ["Aiko", "And one tab we kept for a month, read-only, until people stopped opening it."],
      ],
    }),
    episode({
      id: "ep-21",
      number: 21,
      title: "Forecasting with confidence bands",
      summary:
        "Seasonal baselines, anomaly flags and the one chart leadership actually reads — a short, practical episode.",
      published: "5 Aug 2026",
      seconds: 10,
      guests: ["Sven Aalto"],
      motif: "waves",
      chapters: ["Intro", "Baselines", "Bands, not points", "The leadership chart"],
      transcript: [
        ["Mara", "Sven, you refuse to show a forecast as a single line."],
        [
          "Sven",
          "A line says ‘this will happen’. A band says ‘this is what we’d be surprised by’. Only the second one is honest.",
        ],
        ["Mara", "And leadership reads the band?"],
        ["Sven", "They read the week it left the band. That’s the whole chart."],
        ["Mara", "One chart."],
        ["Sven", "One chart, updated every morning, and an alert when reality leaves the band."],
      ],
    }),
    episode({
      id: "ep-20",
      number: 20,
      title: "The driver app the drivers kept",
      summary:
        "A pilot that was supposed to end — and what it took for a workforce that hates new software to ask for more of it.",
      published: "22 Jul 2026",
      seconds: 13,
      guests: ["Sven Aalto", "Leila Haddad"],
      motif: "skyline",
      chapters: [
        "Intro",
        "Why drivers hate apps",
        "Gate, window, paperwork",
        "The pilot that didn’t end",
      ],
      transcript: [
        ["Mara", "Sven, drivers chose to keep the app. You said that had never happened."],
        ["Sven", "Never. Usually the pilot ends and the phones go back in the glovebox."],
        [
          "Leila",
          "The difference was that it showed them three things they needed and nothing else: the gate, the window, the paperwork.",
        ],
        ["Mara", "No dashboard for the drivers."],
        ["Leila", "No dashboard. The dashboard is for us. The driver gets the next thing."],
        ["Sven", "And they kept it. Ninety-four percent, weekly."],
      ],
    }),
    episode({
      id: "ep-19",
      number: 19,
      title: "Knowing before the customer does",
      summary:
        "Kestrel Foods on vessel slips, proposed fixes and the call that now goes out before the complaint comes in.",
      published: "8 Jul 2026",
      seconds: 11,
      guests: ["Tomas Pereira"],
      motif: "field",
      chapters: ["Intro", "The slip", "A fix, already proposed", "The call that goes out first"],
      transcript: [
        ["Mara", "Tomas, tell me about the vessel."],
        [
          "Tomas",
          "It slipped a day. Before, we’d find out when the customer called. Now we knew at six in the morning, with a re-route already drafted.",
        ],
        ["Mara", "So the customer got a call."],
        [
          "Tomas",
          "From us, before lunch, with the new date. That’s the whole difference — who calls whom.",
        ],
        ["Mara", "That’s a good place to end."],
      ],
    }),
  ],
};
