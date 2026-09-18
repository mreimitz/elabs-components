"use client";

/**
 * Settings surface (RM-097) — the tour's "Settings" tab: a sectioned settings screen scoped
 * to the frame (a narrow section rail, not the full-page `SidebarProvider` chrome the
 * `docs/playbooks/templates/settings.tsx` template uses). Sections: workspace, members,
 * notifications, API keys and a guarded danger zone, all over Ashgrove's own
 * `content/fixtures/settings.ts` (RM-095) — members are the same nine owners the data-app
 * tab's "Owner" column shows.
 *
 * The danger-zone delete opens a raw `AlertDialog` (not the shared `ConfirmDialog`, which has
 * no `disabled`-until-typed hook on its confirm action) requiring the workspace name to be
 * typed before the destructive action enables — "Try the guarded delete" (RM-097's hint).
 */
import { useId, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Descriptions,
  DescriptionsItem,
  Input,
  Label,
  Separator,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  buttonVariants,
  cn,
} from "@elabs-ai/components-ui";
import {
  SETTINGS_API_KEYS,
  SETTINGS_DANGER_ZONE,
  SETTINGS_MEMBERS,
  SETTINGS_NOTIFICATIONS,
  SETTINGS_WORKSPACE,
  type MemberRole,
} from "../../../content/fixtures/settings";
import { tourCopy } from "../../../content/copy";

const LOCALE = "en-US";
const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" });

const ROLE_BADGE: Record<
  MemberRole,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  owner: { label: "Owner", variant: "default" },
  admin: { label: "Admin", variant: "secondary" },
  member: { label: "Member", variant: "outline" },
  viewer: { label: "Viewer", variant: "outline" },
};

const SECTIONS = [
  { id: "workspace", label: "Workspace" },
  { id: "members", label: "Members" },
  { id: "notifications", label: "Notifications" },
  { id: "api-keys", label: "API keys" },
  { id: "danger", label: "Danger zone" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function WorkspaceSection() {
  const [name, setName] = useState(SETTINGS_WORKSPACE.name);
  const nameId = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Workspace</CardTitle>
        <CardDescription>
          Details every member of {SETTINGS_WORKSPACE.name} can see.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={nameId}>Workspace name</Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Descriptions columns={2} layout="vertical">
          <DescriptionsItem label="Legal name">{SETTINGS_WORKSPACE.legalName}</DescriptionsItem>
          <DescriptionsItem label="Plan">{SETTINGS_WORKSPACE.plan}</DescriptionsItem>
          <DescriptionsItem label="Timezone">{SETTINGS_WORKSPACE.timezone}</DescriptionsItem>
        </Descriptions>
      </CardContent>
    </Card>
  );
}

function MembersSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Members</CardTitle>
        <CardDescription>Everyone with access to this workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SETTINGS_MEMBERS.map((member) => (
              <TableRow key={member.email}>
                <TableCell>{member.name}</TableCell>
                <TableCell className="text-muted-foreground">{member.email}</TableCell>
                <TableCell>
                  <Badge variant={ROLE_BADGE[member.role].variant}>
                    {ROLE_BADGE[member.role].label}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NotificationsSection() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SETTINGS_NOTIFICATIONS.map((n) => [n.id, n.enabled])),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Notifications</CardTitle>
        <CardDescription>Control which alerts reach the team.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {SETTINGS_NOTIFICATIONS.map((notification) => (
          <div key={notification.id} className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={notification.id}>{notification.label}</Label>
              <p className="text-caption text-muted-foreground">{notification.description}</p>
            </div>
            <Switch
              id={notification.id}
              checked={enabled[notification.id] ?? false}
              onCheckedChange={(checked) =>
                setEnabled((old) => ({ ...old, [notification.id]: checked }))
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ApiKeysSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">API keys</CardTitle>
        <CardDescription>Keys used by services connecting to this workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SETTINGS_API_KEYS.map((key) => (
              <TableRow key={key.id}>
                <TableCell>{key.label}</TableCell>
                <TableCell className="text-code font-mono">{key.maskedValue}</TableCell>
                <TableCell>{key.createdBy}</TableCell>
                <TableCell>{dateFormat.format(new Date(key.created))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DangerZoneSection() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const workspaceName = SETTINGS_WORKSPACE.name;
  const confirmed = typed === workspaceName;

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle as="h2">Danger zone</CardTitle>
        <CardDescription>{SETTINGS_DANGER_ZONE.deleteWorkspaceDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div>
            <p className="text-body font-medium">{SETTINGS_DANGER_ZONE.transferOwnershipLabel}</p>
            <p className="text-caption text-muted-foreground">
              Hand the owner role to another member.
            </p>
          </div>
          <Button variant="outline">{SETTINGS_DANGER_ZONE.transferOwnershipLabel}</Button>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/40 p-3">
          <div>
            <p className="text-body font-medium">{SETTINGS_DANGER_ZONE.deleteWorkspaceLabel}</p>
            <p className="text-caption text-muted-foreground">This cannot be undone.</p>
          </div>
          <AlertDialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setTyped("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">{SETTINGS_DANGER_ZONE.deleteWorkspaceLabel}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{SETTINGS_DANGER_ZONE.deleteWorkspaceLabel}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {SETTINGS_DANGER_ZONE.deleteWorkspaceDescription} Type “{workspaceName}” to
                  confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={inputId}>Workspace name</Label>
                <Input
                  id={inputId}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={workspaceName}
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!confirmed}
                  className={cn(buttonVariants({ variant: "destructive" }))}
                >
                  {SETTINGS_DANGER_ZONE.deleteWorkspaceLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

const VIEWS: Record<SectionId, () => React.JSX.Element> = {
  workspace: WorkspaceSection,
  members: MembersSection,
  notifications: NotificationsSection,
  "api-keys": ApiKeysSection,
  danger: DangerZoneSection,
};

export function SettingsSurface() {
  const [active, setActive] = useState<SectionId>("workspace");
  const ActiveView = useMemo(() => VIEWS[active], [active]);

  return (
    <div className="flex size-full min-h-0" aria-label={tourCopy.tabs.settings.label}>
      <nav aria-label="Settings sections" className="w-44 shrink-0 border-e p-2">
        <ul className="flex flex-col gap-1">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <Button
                variant={active === section.id ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActive(section.id)}
              >
                {section.label}
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 overflow-auto p-6">
        <ActiveView />
      </div>
    </div>
  );
}
