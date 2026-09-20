/**
 * Visual QA page for every UI primitive. Dev aid only — removed in Phase 8.
 * Route: /_kitchen-sink
 */

import type { RunStatus } from "@cronrunner/shared";
import { Inbox, Pencil, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, StatusBadge, Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Kbd } from "@/components/ui/Kbd";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Table, TBody, Td, THead, Th, Tr } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";
import { absoluteTime, formatDuration, relativeTime } from "@/lib/format";

const STATUSES: RunStatus[] = ["running", "success", "failed", "timeout", "killed"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-default">{title}</h2>
      <Card>
        <CardBody className="flex flex-wrap items-start gap-4">{children}</CardBody>
      </Card>
    </section>
  );
}

export function KitchenSinkPage() {
  const toast = useToast();
  const [checked, setChecked] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const now = new Date().toISOString();

  return (
    <>
      <PageHeader title="Kitchen sink" subtitle="Every primitive, every state. Dev only." />

      <Section title="Buttons">
        {(["primary", "secondary", "ghost", "danger"] as const).map((variant) => (
          <div key={variant} className="flex items-center gap-2">
            <Button variant={variant} size="sm">
              {variant} sm
            </Button>
            <Button variant={variant}>{variant} md</Button>
            <Button variant={variant} loading>
              loading
            </Button>
            <Button variant={variant} disabled>
              disabled
            </Button>
          </div>
        ))}
        <Button variant="secondary" icon={<Play className="size-3.5" />}>
          With icon
        </Button>
        <Button
          variant="secondary"
          iconOnly
          aria-label="Edit"
          icon={<Pencil className="size-4" />}
        />
      </Section>

      <Section title="Form fields">
        <div className="grid w-full grid-cols-2 gap-4">
          <Input label="Name" placeholder="Nightly backup" hint="Shown in the jobs list." />
          <Input label="Cron" mono defaultValue="0 2 * * *" error="Something is wrong" />
          <Select label="Shell" defaultValue="auto">
            <option value="auto">Auto (bash)</option>
            <option value="zsh">zsh</option>
          </Select>
          <Input label="Disabled" placeholder="Can't touch this" disabled />
          <Textarea
            label="Command"
            mono
            className="col-span-2"
            defaultValue={'echo "hello"\ndate'}
          />
        </div>
        <div className="flex items-center gap-6">
          <Switch checked={checked} onChange={setChecked} label="Enabled" showLabel />
          <Switch
            checked={!checked}
            onChange={(v) => setChecked(!v)}
            label="Small"
            size="sm"
            showLabel
          />
          <Switch checked={false} onChange={() => {}} label="Disabled switch" disabled showLabel />
        </div>
      </Section>

      <Section title="Badges and tags">
        {STATUSES.map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
        <Badge tone="accent">accent</Badge>
        <Badge tone="neutral" dot>
          neutral
        </Badge>
        <Tag>backup</Tag>
        <Tag>nightly</Tag>
        <Kbd>N</Kbd>
        <Tooltip label="0 2 * * *">
          <span className="text-xs text-muted underline decoration-dotted">hover for cron</span>
        </Tooltip>
      </Section>

      <Section title="Feedback">
        <Button onClick={() => toast.success("Job saved")}>Toast success</Button>
        <Button onClick={() => toast.error("Could not reach the daemon")}>Toast error</Button>
        <Button onClick={() => toast.info("Run started")}>Toast info</Button>
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Confirm delete
        </Button>
      </Section>

      <Section title="Formatting">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <dt className="text-muted">relativeTime</dt>
          <dd className="font-mono">{relativeTime(now)}</dd>
          <dt className="text-muted">absoluteTime</dt>
          <dd className="font-mono">{absoluteTime(now)}</dd>
          <dt className="text-muted">formatDuration</dt>
          <dd className="font-mono">
            {formatDuration(840)} · {formatDuration(3200)} · {formatDuration(252_000)} ·{" "}
            {formatDuration(3_920_000)}
          </dd>
        </dl>
      </Section>

      <Section title="Code block">
        <CodeBlock
          className="w-full"
          code={'rsync -a --delete "$HOME/Documents/" "$HOME/Backups/documents/"'}
        />
      </Section>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-default">Table</h2>
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Schedule</Th>
              <Th>Last run</Th>
              <Th className="w-10" />
            </Tr>
          </THead>
          <TBody>
            <Tr clickable>
              <Td className="font-medium">Nightly backup</Td>
              <Td className="text-muted">At 02:00 AM, every day</Td>
              <Td>
                <StatusBadge status="success" />
              </Td>
              <Td>
                <DropdownMenu
                  items={[
                    {
                      label: "Edit",
                      icon: <Pencil className="size-3.5" />,
                      onSelect: () => toast.info("Edit"),
                    },
                    {
                      label: "Delete",
                      icon: <Trash2 className="size-3.5" />,
                      destructive: true,
                      onSelect: () => toast.error("Delete"),
                    },
                  ]}
                />
              </Td>
            </Tr>
            <SkeletonRows rows={2} cols={4} />
          </TBody>
        </Table>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-default">Empty state</h2>
          <EmptyState
            icon={Inbox}
            title="No jobs yet"
            description="Create your first scheduled job to see it here."
            action={
              <Button variant="primary" size="sm">
                Create job
              </Button>
            }
          />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-default">Card & skeleton</h2>
          <Card>
            <CardHeader
              title="Upcoming"
              subtitle="Next runs"
              actions={
                <Button size="sm" variant="ghost">
                  View all
                </Button>
              }
            />
            <CardBody className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Example dialog"
        description="Esc closes it, focus is trapped, focus returns to the trigger."
        footer={
          <Button variant="primary" size="sm" onClick={() => setDialogOpen(false)}>
            Done
          </Button>
        }
      >
        <Input label="A field inside" placeholder="Tab around" />
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          toast.success("Deleted");
        }}
        title="Delete “Nightly backup”?"
        description="This removes the job and its run history. It cannot be undone."
        confirmLabel="Delete job"
        destructive
      />
    </>
  );
}
