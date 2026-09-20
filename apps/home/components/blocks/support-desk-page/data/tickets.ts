// registry: support-desk-page — copied 2026-09-19
/** Acme Logistics — the customer support queue, mid-morning. Facts only. */

export type TicketPriority = "urgent" | "high" | "normal";
export type TicketChannel = "Email" | "Chat" | "Portal";

export interface TicketMessage {
  from: "customer" | "agent";
  author: string;
  time: string;
  text: string;
}

export interface SimilarTicket {
  id: string;
  title: string;
  resolution: string;
}

export interface Ticket {
  id: string;
  subject: string;
  customer: string;
  company: string;
  plan: "Strategic" | "Business" | "Starter";
  channel: TicketChannel;
  priority: TicketPriority;
  /** Minutes left before the first-response or next-reply promise is broken. */
  slaMinutesLeft: number;
  /** The promise itself, in minutes. */
  slaMinutes: number;
  waitingSince: string;
  messages: TicketMessage[];
  /** What the copilot proposes to send, grounded in `similar`. */
  draft: string;
  similar: SimilarTicket[];
}

export const tickets: Ticket[] = [
  {
    id: "T-88214",
    subject: "Labels print blank at Depot 2 since this morning",
    customer: "Leila Haddad",
    company: "Northwind Retail",
    plan: "Strategic",
    channel: "Portal",
    priority: "urgent",
    slaMinutesLeft: 11,
    slaMinutes: 60,
    waitingSince: "09:02",
    messages: [
      {
        from: "customer",
        author: "Leila Haddad",
        time: "09:02",
        text: "Every label from the two Zebra printers at Depot 2 comes out blank since the 08:00 shift. Depot 1 is fine. We have 340 parcels waiting and the first truck leaves at 11:30.",
      },
      {
        from: "agent",
        author: "Jonas Weber",
        time: "09:09",
        text: "Thanks Leila — I can see the print jobs arriving, so the connection is fine. Can you tell me whether the printers were restarted this morning, and which label template the shift is using?",
      },
      {
        from: "customer",
        author: "Leila Haddad",
        time: "09:21",
        text: "They were restarted at 07:50 after a power cut. Template is 'Parcel 100x150 v3'.",
      },
    ],
    draft:
      "Leila, that explains it. After a power cut these printers fall back to their factory media setting, and the v3 template then prints outside the label. On each printer hold **Feed** for two seconds to run the media calibration — it takes about ten seconds and needs no restart. If a printer still prints blank after that, tell me which one and I will push the settings to it remotely. You should be labelling again well before the 11:30 truck.",
    similar: [
      {
        id: "T-86120",
        title: "Blank labels after printer restart",
        resolution: "Media calibration; resolved in 6 minutes",
      },
      {
        id: "T-84977",
        title: "Template prints off-label at new depot",
        resolution: "Pushed media settings remotely",
      },
    ],
  },
  {
    id: "T-88209",
    subject: "Customs hold on SH-20377 — what do you need from us?",
    customer: "Dr. Marta Lind",
    company: "Halden Pharma",
    plan: "Strategic",
    channel: "Email",
    priority: "high",
    slaMinutesLeft: 47,
    slaMinutes: 120,
    waitingSince: "08:41",
    messages: [
      {
        from: "customer",
        author: "Dr. Marta Lind",
        time: "08:41",
        text: "We were told our reefer shipment is held at customs in New York. These are temperature-sensitive. What is missing and how long do the units hold temperature?",
      },
    ],
    draft:
      "Dr. Lind, the inspector asked for the cold-chain certificate; our broker re-filed it at 08:40 and expects a decision by 14:00 local time. The reefers are on shore power and hold temperature indefinitely while plugged in — and for 36 hours if they are moved. Nothing is needed from you right now. I will write again by 14:30 with the release or the next step.",
    similar: [
      {
        id: "T-87402",
        title: "Reefer held for cold-chain certificate",
        resolution: "Released same day after re-filing",
      },
    ],
  },
  {
    id: "T-88197",
    subject: "Invoice shows overage we did not expect",
    customer: "Pieter de Boer",
    company: "Northwind Retail",
    plan: "Strategic",
    channel: "Email",
    priority: "normal",
    slaMinutesLeft: 205,
    slaMinutes: 480,
    waitingSince: "Yesterday",
    messages: [
      {
        from: "customer",
        author: "Pieter de Boer",
        time: "Yesterday 16:12",
        text: "August's invoice has 670 shipments billed as overage. Can you show me how that number is calculated?",
      },
    ],
    draft:
      "Pieter, the contract commits 4,200 shipments a month; August had 4,870, so 670 were billed at the overage rate. I have attached the per-day breakdown. Since you have been above commitment for three months, raising the commitment would lower the total — your account owner Ava can walk you through the numbers.",
    similar: [
      {
        id: "T-85510",
        title: "Overage calculation question",
        resolution: "Sent daily breakdown; commitment raised at renewal",
      },
    ],
  },
  {
    id: "T-88190",
    subject: "Driver app logs out every few minutes",
    customer: "Sven Aalto",
    company: "Pelican Lines",
    plan: "Business",
    channel: "Chat",
    priority: "high",
    slaMinutesLeft: 64,
    slaMinutes: 120,
    waitingSince: "08:15",
    messages: [
      {
        from: "customer",
        author: "Sven Aalto",
        time: "08:15",
        text: "Four of our drivers are logged out of the app every five minutes or so. All on Android, all updated last night.",
      },
    ],
    draft:
      "Sven, last night's Android update had a token-refresh bug; a fix went live at 08:47. Ask the four drivers to close the app fully and open it again — they will stay signed in from then on. If anyone is still logged out after that, send me their driver ID and I will reset the session on our side.",
    similar: [
      {
        id: "T-88102",
        title: "Repeated logouts after update",
        resolution: "Fixed by release 4.18.1",
      },
    ],
  },
  {
    id: "T-88176",
    subject: "How do we add a second pickup address?",
    customer: "Aiko Mori",
    company: "Bluewater Marine",
    plan: "Starter",
    channel: "Portal",
    priority: "normal",
    slaMinutesLeft: 388,
    slaMinutes: 480,
    waitingSince: "07:30",
    messages: [
      {
        from: "customer",
        author: "Aiko Mori",
        time: "07:30",
        text: "We opened a second warehouse. Where do I add it so it shows up when booking?",
      },
    ],
    draft:
      "Aiko, go to **Settings → Locations → Add location**. Once it is saved it appears in the pickup list straight away. If you want it as the default for certain users, you can set that on each user's profile.",
    similar: [],
  },
];
