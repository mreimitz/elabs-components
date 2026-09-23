/**
 * The tour of each use-case template, authored once and read by the template's page, the home
 * showcase, the template prompt and `/llms/templates`: who sits in front of the product and
 * what happens (`scenario`), what each view the navigation names shows (`views`), and the one
 * thing a visitor can do on the screen that changes it (`interaction`). What a template is
 * MADE OF is never written here — it is generated from the registry item's dependencies.
 *
 * Keyed by the template's catalogue slug. A template without an entry keeps its generated lead.
 */
export interface TemplateView {
  /** The label as the navigation shows it. */
  label: string;
  /** What the view shows, in one line. */
  shows: string;
}

export interface TemplateTour {
  /** The world this product belongs to — how the home page groups templates. */
  domain: TemplateDomain;
  /** Two sentences: who uses it, and what happens on the screen. */
  scenario: string;
  views: TemplateView[];
  /** What the visitor can do on the live screen, and what it changes. */
  interaction: string;
}

export type TemplateDomain =
  | "operations"
  | "revenue"
  | "customers"
  | "agents"
  | "engineering"
  | "energy"
  | "security";

export const TEMPLATE_DOMAINS: Record<TemplateDomain, string> = {
  operations: "Operations",
  revenue: "Revenue & markets",
  customers: "Customers & support",
  agents: "AI agents",
  engineering: "Engineering & reliability",
  energy: "Energy & utilities",
  security: "Security",
};

export const TEMPLATE_TOURS: Record<string, TemplateTour> = {
  "market-desk": {
    domain: "revenue",
    scenario:
      "A rate desk at a logistics company prices container lanes for the week. The trader watches the tape, picks a lane from the watchlist and commits boxes on a ticket that checks the desk limit before anything is placed.",
    views: [
      { label: "Market", shows: "The tape: every lane's last price, move and twenty-day trend." },
      {
        label: "Watchlist",
        shows: "The lanes this desk trades; a row puts its lane on the ticket.",
      },
      { label: "Charts", shows: "One lane in full — closes, volume, the desk's own marks." },
      { label: "Orders", shows: "The blotter: what went in today, at what price." },
      { label: "Positions", shows: "What the desk holds per lane and what it is worth now." },
      { label: "Limits", shows: "Ticket and book limits, and who signs above them." },
      { label: "Research", shows: "Notes and forecasts the desk writes for itself." },
    ],
    interaction:
      "Pick a lane in the watchlist, enter boxes on the ticket, review and place the order — it lands in the blotter, and a ticket over the limit is refused with the reason.",
  },
  "revenue-operations": {
    domain: "revenue",
    scenario:
      "A revenue team opens Monday with the number against plan. The period and region controls re-slice every chart and the pipeline below; a stalled deal is flagged from its own activity, and the analyst in the dock answers in the numbers on screen.",
    views: [
      {
        label: "Revenue desk",
        shows: "Revenue against plan, by segment and week, as one command center.",
      },
      {
        label: "Pipeline",
        shows: "Every open deal with win probability, activity trend and a stalled flag.",
      },
      { label: "Forecast", shows: "The quarter's forecast with its confidence band." },
      { label: "Targets", shows: "Targets per team and how far each is from them." },
      { label: "Accounts", shows: "The accounts behind the pipeline." },
      { label: "People", shows: "Owners, quotas and attainment." },
      { label: "Reports", shows: "Saved views the team shares." },
    ],
    interaction:
      "Change the period or the region in the header and watch the charts and the pipeline re-slice; select pipeline rows to act on them together.",
  },
  "logistics-control-tower": {
    domain: "operations",
    scenario:
      "An operations team keeps this screen open all day. The headline counts the promises at risk; the map shows the network and the fleet; the exceptions table is sorted by the promise that breaks first, and a row opens the shipment with its recommended next step.",
    views: [
      { label: "Overview", shows: "The headline, the network map and the exceptions table." },
      { label: "Exceptions", shows: "Every late or at-risk shipment, closest promise first." },
      { label: "Shipments", shows: "All shipments in flight." },
      { label: "Fleet", shows: "Vehicles and vessels, live on the map." },
      { label: "Lanes", shows: "The lanes the network runs and their reliability." },
      { label: "Depots", shows: "Depots and their load." },
      { label: "Inventory", shows: "Stock per depot." },
    ],
    interaction:
      "Click an exception: the dock opens with the shipment's details, the recommended next step and its journey as a timeline.",
  },
  "energy-operations": {
    domain: "energy",
    scenario:
      "A utility's site desk runs the grid connection of eight industrial parks. The headline says who is buying above contract and who is near the capacity band; the table and the map name the same sites; picking one re-reads its 120 days of meters and opens its contract, its alarms and an analyst beside the screen.",
    views: [
      { label: "Sites", shows: "The fleet headline, the KPIs, the sites table and the map." },
      {
        label: "Alarms",
        shows: "Every open alarm, most severe first, with the runbook's response.",
      },
      { label: "Map", shows: "The sites where they stand, status as colour, glyph and word." },
      { label: "Forecast", shows: "The selected site's meters against the day-ahead price." },
      { label: "Contracts", shows: "Supply agreements per site — supplier, price, end date." },
      { label: "Reports", shows: "Monthly cost and consumption per site." },
    ],
    interaction:
      "Select a site in the table or on the map: the energy desk re-reads its meters, the dock opens with its contract and alarms, and Acknowledge steps the site down from alarm to watch — the nav badge and the row agree.",
  },
  "security-operations": {
    domain: "security",
    scenario:
      "A security team's triage screen. The headline says how many alerts are open, how many are critical and how old the oldest is; the queue and the map name the same assets; picking an alert opens its indicators, the alerts linked by the same user or host, and an analyst that has already enriched the indicators and waits for the approval to isolate the host.",
    views: [
      {
        label: "Queue",
        shows: "The headline, the KPIs, the alert queue under its filters and the map.",
      },
      {
        label: "Assets",
        shows:
          "The open alerts clustered on the offices, data centres and cloud regions they fire from.",
      },
      {
        label: "Incidents",
        shows: "Ninety days of incidents per source, read by the incident explorer.",
      },
      { label: "Hunts", shows: "The hunts in progress and what they have found." },
      { label: "Detections", shows: "The rules in force, per source, and how often each fires." },
      { label: "Reports", shows: "Monthly volume, time to contain and the sources behind it." },
    ],
    interaction:
      "Triage an alert from the queue or the map: the dock opens with its indicators and linked alerts, Contain asset isolates the host and steps the row to contained — the nav badge, the KPIs and the toast's Undo agree.",
  },
  "developer-platform": {
    domain: "engineering",
    scenario:
      "A platform team's delivery control room. The headline says how many of today's runs failed and whether main is green; the four DORA numbers sit above the pipeline graph, the run's own log and the table of runs; picking a failed run opens the stage it stopped at, the failing check and the change under test as a diff, with the re-run one click away and written to the audit trail.",
    views: [
      {
        label: "Pipelines",
        shows: "The stages of the selected run as a graph, and its log as it printed.",
      },
      { label: "Runs", shows: "Every run of the day under its filters, most urgent first." },
      {
        label: "Deployments",
        shows: "Deploys per day, lead time, change failure rate and time to restore.",
      },
      { label: "Audit", shows: "Who re-ran or cancelled what, append-only." },
    ],
    interaction:
      "Open a failed run from the table: the dock names the stage it stopped at and shows the diff under test; Re-run failed stage queues it again — the graph, the nav badge and the audit trail agree, and the toast's Undo takes it back.",
  },
  "incident-command": {
    domain: "engineering",
    scenario:
      "One live incident, run from one screen. The commander sees severity, impact and the error rate streaming in; the blast radius is the dependency web; the runbook's steps print into a terminal, tick off and write the incident log until the last one settles the stream.",
    views: [
      { label: "Overview", shows: "Severity, impact, commander, the error rate live." },
      { label: "Incidents", shows: "Open and recent incidents." },
      { label: "Alerts", shows: "What is paging right now." },
      { label: "Promises", shows: "Service-level objectives and their budgets." },
      { label: "Services", shows: "Every service and its owner." },
      { label: "Dependencies", shows: "The dependency web the blast radius is read from." },
      { label: "Runbooks", shows: "The runbooks this team runs." },
    ],
    interaction:
      "Run the runbook step by step: each step prints into the terminal, moves the recovery meter and writes the log; the last one unlocks Resolve.",
  },
  "process-explorer": {
    domain: "operations",
    scenario:
      "A process analyst opens an order-to-cash event log. The map shows how orders really flow; the insights beside it rank the slowest hand-overs and the throughput against the service level; variants, the dotted chart and the case table sit in the dock, all driven by one selection.",
    views: [
      { label: "Order to cash", shows: "The process map, its KPIs and the statistical insights." },
    ],
    interaction:
      "Select an activity or a hand-over on the map: the insights, the variants and the case table re-read for it; replay animates every order as a token.",
  },
  "customer-360": {
    domain: "customers",
    scenario:
      "An account manager opens one account five minutes before the call. Health, usage against the contract, next actions and the people are on one screen, and the brief in the dock says what changed since last time.",
    views: [
      { label: "Home", shows: "The book of accounts and what needs attention." },
      { label: "Accounts", shows: "One account: metrics, usage, health, actions, people." },
      { label: "People", shows: "Every contact and the relationship gap." },
      { label: "Renewals", shows: "What renews when, and its risk." },
      { label: "Deals", shows: "Open expansion and renewal deals." },
      { label: "Tickets", shows: "Open support tickets on the account." },
      { label: "Documents", shows: "Contracts and order forms." },
    ],
    interaction:
      "Complete a next action in place and open the account brief in the dock; the health score explains itself when opened.",
  },
  "support-desk": {
    domain: "customers",
    scenario:
      "A support agent works a queue sorted by the promise that breaks first. The conversation is in the middle, the customer and what solved it before on the right, and the copilot drafts a reply grounded in named past tickets that the agent sends or discards.",
    views: [
      { label: "My queue", shows: "The agent's tickets, the promise that breaks first on top." },
      { label: "Team queue", shows: "Everything the team holds." },
      {
        label: "Promises at risk",
        shows: "Tickets whose response or resolution promise is close.",
      },
      { label: "Knowledge base", shows: "Articles the copilot cites." },
      { label: "Reports", shows: "Volume, response and resolution over time." },
      { label: "Help center", shows: "What customers see." },
    ],
    interaction:
      "Open a ticket, send the drafted reply: the clock restarts and the queue re-sorts.",
  },
  "project-hub": {
    domain: "operations",
    scenario:
      "A product team runs projects, an issue board, team load and members as one product. Every view reads the same issues, so a move on the board changes the load, the overview and the navigation counts.",
    views: [
      { label: "Overview", shows: "Projects and their state at a glance." },
      { label: "Projects", shows: "Project cards with progress and owners." },
      { label: "Issues", shows: "The board — drag an issue between columns." },
      { label: "Team load", shows: "Who holds how much, from the same issues." },
      { label: "Members", shows: "The team and their roles." },
    ],
    interaction:
      "Move an issue on the board and watch the team load, the overview and the navigation counts follow; the dock explains the project or issue last opened.",
  },
  "agent-operations-center": {
    domain: "agents",
    scenario:
      "The control room for a fleet of AI agents in production. Spend against limits, the escalation boundary and the insight feed on one tab; the trace waterfall and the hand-off inspector on the next; a run review with its decision record; and the audit log.",
    views: [
      {
        label: "Overview",
        shows: "The insight feed, spend against limit and the escalation boundary.",
      },
      { label: "Runs", shows: "The trace waterfall and the hand-off inspector." },
      {
        label: "Review queue",
        shows: "Runs waiting for a human decision, with the decision record.",
      },
      { label: "Audit log", shows: "Every action, by whom, with what evidence." },
      { label: "Agents", shows: "The fleet and each agent's state." },
      { label: "Budgets", shows: "Spend limits per agent and team." },
      { label: "Guardrails", shows: "What the agents may not do." },
      { label: "Evaluations", shows: "How each agent scores over time." },
    ],
    interaction:
      "Approve or reject a run in the review queue: the decision is recorded, the count in the navigation and the header changes.",
  },
  "agent-studio": {
    domain: "agents",
    scenario:
      "Where a business designs, equips and watches its agents. Every design is listed with how it ran this week; the designer is a canvas; skills and MCP servers show which designs use them; a run opens in the dock with its steps, and a failed one opens its full trace.",
    views: [
      { label: "Designs", shows: "Every agent design and how it ran this week." },
      { label: "Designer", shows: "The agent's graph on a canvas, with an inspector." },
      { label: "Skills", shows: "The skill library and which designs use each." },
      { label: "MCP servers", shows: "Connected servers and their tools." },
      { label: "Runs", shows: "Runs by state; a paused one names who it waits for." },
    ],
    interaction: "Open a run in the dock; a failed run opens its trace as a waterfall.",
  },
  "generative-ui-assistant": {
    domain: "agents",
    scenario:
      "An assistant that answers with screens. Five conversations — a refund decision, an analytics answer with charts, an incident form, a release plan, a surface the catalog refuses — stream in as A2UI data and render from the library's catalog; every click reaches the app as a named action.",
    views: [
      { label: "Assistant", shows: "The conversation and the surfaces it renders." },
      { label: "Conversations", shows: "The five saved conversations." },
    ],
    interaction:
      "Click a rendered surface — approve the refund, change the form — and the inspector shows the action and the wire JSON that produced the screen.",
  },
};

export const tourOf = (slug: string): TemplateTour | undefined => TEMPLATE_TOURS[slug];
