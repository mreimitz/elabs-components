// registry: settings-members-01 — copied 2026-09-19
"use client";

import { useState, type FormEvent } from "react";
import { MailPlus, UserMinus } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FieldControl,
  FieldError,
  FieldLabel,
  FieldRoot,
  IconButton,
  Input,
  Meter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@elabs-ai/components-ui";

export type MemberRole = "Owner" | "Admin" | "Member" | "Viewer";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  /** `invited` until they accept. */
  state: "active" | "invited";
  lastSeen: string;
}

export interface SettingsMembersProps {
  defaultMembers?: Member[];
  /** Seats the plan includes. */
  seats?: number;
  onInvite?: (email: string, role: MemberRole) => void;
  onRoleChange?: (member: Member, role: MemberRole) => void;
  onRemove?: (member: Member) => void;
}

const ROLES: { role: MemberRole; can: string }[] = [
  { role: "Admin", can: "Manage members, billing and every shipment" },
  { role: "Member", can: "Create and edit shipments" },
  { role: "Viewer", can: "Read only" },
];

const DEFAULT_MEMBERS: Member[] = [
  {
    id: "1",
    name: "Ada Okonkwo",
    email: "ada@acme-logistics.example",
    role: "Owner",
    state: "active",
    lastSeen: "Now",
  },
  {
    id: "2",
    name: "Ravi Menon",
    email: "ravi@acme-logistics.example",
    role: "Admin",
    state: "active",
    lastSeen: "2 h ago",
  },
  {
    id: "3",
    name: "Mei Tanaka",
    email: "mei@acme-logistics.example",
    role: "Member",
    state: "active",
    lastSeen: "Yesterday",
  },
  {
    id: "4",
    name: "Jonas Weber",
    email: "jonas@acme-logistics.example",
    role: "Member",
    state: "active",
    lastSeen: "3 days ago",
  },
  {
    id: "5",
    name: "sven@pelican-lines.example",
    email: "sven@pelican-lines.example",
    role: "Viewer",
    state: "invited",
    lastSeen: "Invited 2 days ago",
  },
];

const initials = (name: string) =>
  name
    .split(/[ @.]/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * Members — who has access and what they can do. Roles change in place, the owner cannot be
 * demoted or removed, inviting checks the address and the seat count, and removing someone
 * asks first and says what they lose.
 */
export function SettingsMembers({
  defaultMembers = DEFAULT_MEMBERS,
  seats = 8,
  onInvite,
  onRoleChange,
  onRemove,
}: SettingsMembersProps) {
  const [members, setMembers] = useState(defaultMembers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("Member");
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Member | null>(null);
  const full = members.length >= seats;

  function invite(event: FormEvent) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      return setError("Enter the email of the person to invite.");
    if (members.some((member) => member.email === address))
      return setError("That person already has access.");
    setMembers((prev) => [
      ...prev,
      {
        id: address,
        name: address,
        email: address,
        role,
        state: "invited",
        lastSeen: "Invited just now",
      },
    ]);
    onInvite?.(address, role);
    setEmail("");
    setError(null);
    setInviteOpen(false);
  }

  return (
    <Card className="mx-auto w-full max-w-3xl" data-slot="settings-members">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members.length} of {seats} seats used
            {full ? " — add seats in Billing to invite more." : "."}
          </CardDescription>
          <Meter
            aria-label={`${members.length} of ${seats} seats used`}
            className="w-48"
            max={seats}
            size="xs"
            value={members.length}
          />
        </div>
        <Dialog onOpenChange={setInviteOpen} open={inviteOpen}>
          <DialogTrigger asChild>
            <Button disabled={full}>
              <MailPlus aria-hidden="true" />
              Invite someone
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form className="flex flex-col gap-5" noValidate onSubmit={invite}>
              <DialogHeader>
                <DialogTitle>Invite someone</DialogTitle>
                <DialogDescription>
                  They get an email with a link that works for seven days.
                </DialogDescription>
              </DialogHeader>
              <FieldRoot invalid={error !== null} required>
                <FieldLabel>Email</FieldLabel>
                <FieldControl>
                  <Input
                    autoComplete="off"
                    inputMode="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    type="email"
                    value={email}
                  />
                </FieldControl>
                {error ? <FieldError>{error}</FieldError> : null}
              </FieldRoot>
              <FieldRoot>
                <FieldLabel>Role</FieldLabel>
                <FieldControl>
                  <Select onValueChange={(value) => setRole(value as MemberRole)} value={role}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((item) => (
                        <SelectItem key={item.role} value={item.role}>
                          {item.role} — {item.can}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldControl>
              </FieldRoot>
              <DialogFooter>
                <Button onClick={() => setInviteOpen(false)} type="button" variant="ghost">
                  Cancel
                </Button>
                <Button type="submit">Send invite</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {members.map((member) => (
            <li className="flex flex-wrap items-center gap-3 py-3" key={member.id}>
              <Avatar className="size-9">
                <AvatarFallback className="text-caption">{initials(member.name)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 truncate text-body font-medium">
                  {member.name}
                  {member.state === "invited" ? <Badge variant="secondary">invited</Badge> : null}
                </span>
                <span className="truncate text-meta text-muted-foreground">
                  {member.state === "invited"
                    ? member.lastSeen
                    : `${member.email} · ${member.lastSeen}`}
                </span>
              </div>
              {member.role === "Owner" ? (
                <Badge variant="outline">Owner</Badge>
              ) : (
                <>
                  <Select
                    onValueChange={(value) => {
                      const next = value as MemberRole;
                      setMembers((prev) =>
                        prev.map((m) => (m.id === member.id ? { ...m, role: next } : m)),
                      );
                      onRoleChange?.(member, next);
                    }}
                    value={member.role}
                  >
                    <SelectTrigger aria-label={`Role of ${member.name}`} className="min-w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((item) => (
                        <SelectItem key={item.role} value={item.role}>
                          {item.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <IconButton
                    icon={<UserMinus />}
                    label={
                      member.state === "invited"
                        ? `Cancel the invite to ${member.name}`
                        : `Remove ${member.name}`
                    }
                    onClick={() => setLeaving(member)}
                    variant="ghost"
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      <ConfirmDialog
        confirmLabel={leaving?.state === "invited" ? "Cancel invite" : "Remove"}
        description={
          leaving?.state === "invited"
            ? "The link in their email stops working straight away."
            : `${leaving?.name ?? "They"} loses access now. Shipments they created stay with the workspace.`
        }
        onConfirm={() => {
          if (leaving) {
            setMembers((prev) => prev.filter((m) => m.id !== leaving.id));
            onRemove?.(leaving);
          }
          setLeaving(null);
        }}
        onOpenChange={(open) => !open && setLeaving(null)}
        open={leaving !== null}
        title={
          leaving?.state === "invited" ? "Cancel this invite?" : `Remove ${leaving?.name ?? ""}?`
        }
        tone="destructive"
      />
    </Card>
  );
}
