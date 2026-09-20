// registry: marketing-team-01 — copied 2026-09-19
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, SectionHeader } from "@elabs-ai/components-ui";

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
}

export interface MarketingTeamProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  members?: TeamMember[];
}

const DEFAULT_MEMBERS: TeamMember[] = [
  {
    name: "Ada Okonkwo",
    role: "Chief Executive",
    bio: "Ran a regional parcel network for nine years before writing the first line of this.",
  },
  {
    name: "Ravi Menon",
    role: "Operations",
    bio: "Has worked every shift in a depot, including the ones nobody wants.",
  },
  {
    name: "Mei Tanaka",
    role: "Engineering",
    bio: "Builds the route solver and the things that keep it fast at four in the morning.",
  },
  {
    name: "Jonas Weber",
    role: "Customer success",
    bio: "First call on day one and still on the line at renewal.",
  },
  {
    name: "Noor Haddad",
    role: "Reliability",
    bio: "Believes an incident is only over when the write-up is.",
  },
  { name: "Ava Reyes", role: "Sales", bio: "Will tell you when we are not the right fit." },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

/** The people — a name, what they do, and one line that is about them, not their title. */
export function MarketingTeam({
  eyebrow = "Team",
  title = "Run by people who have worked a dock",
  description = "Forty of us, in Rotterdam, Lisbon and Singapore.",
  members = DEFAULT_MEMBERS,
}: MarketingTeamProps) {
  return (
    <section
      className="@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16"
      data-slot="marketing-team"
    >
      <SectionHeader as="h2" description={description} eyebrow={eyebrow} title={title} />
      <ul className="grid grid-cols-1 gap-x-8 gap-y-10 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {members.map((member) => (
          <li className="flex gap-4" key={member.name}>
            <Avatar className="size-14">
              <AvatarFallback className="text-subtitle">{initials(member.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-body font-semibold">{member.name}</h3>
              <p className="text-meta text-primary">{member.role}</p>
              <p className="text-body text-muted-foreground text-pretty">{member.bio}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
