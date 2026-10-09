import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin, getStaffClientScope } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { SyncTextsButton } from "@/components/texts/text-actions";
import { SendTextForm } from "@/components/texts/send-text-form";
import { TextInboxList } from "@/components/texts/text-inbox";
import { Panel } from "@/components/shared/panel";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { cn, formatRelativeTime } from "@/lib/utils";
import { UserRole } from "@prisma/client";
import { Smartphone, Send } from "lucide-react";

export const metadata: Metadata = {
  title: "Texts",
  description: "Texts with customers and the Voixly team.",
};

export default async function TextsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; client?: string; unlinked?: string }>;
}) {
  const user = await requireAdmin();
  const { q, client: requestedClientId, unlinked } = await searchParams;
  const scope = await getStaffClientScope(user);
  const allowedClientId =
    requestedClientId && (scope === "all" || scope.includes(requestedClientId))
      ? requestedClientId
      : undefined;
  const filteredClient = allowedClientId
    ? await prisma.client.findFirst({
        where: { id: allowedClientId, deletedAt: null },
        select: {
          id: true,
          companyName: true,
          phone: true,
          user: { select: { twoFactorPhone: true } },
        },
      })
    : null;
  const clientId = filteredClient?.id;
  const showUnlinked = user.role === UserRole.ADMIN && unlinked === "1" && !clientId;
  const query = q?.trim() ?? "";
  const digits = query.replace(/\D/g, "");

  const filters = [
    ...(scope === "all"
      ? []
      : [
          {
            OR: [
              { clientId: { in: scope.length ? scope : ["__none__"] } },
              { user: { is: { deletedAt: null, role: { in: [UserRole.ADMIN, UserRole.STAFF] } } } },
            ],
          },
        ]),
    ...(clientId ? [{ clientId }] : []),
    ...(showUnlinked ? [{ clientId: null, userId: null }] : []),
    ...(query
      ? [
          {
            OR: [
              { lastPreview: { contains: query } },
              { client: { companyName: { contains: query } } },
              { client: { contactName: { contains: query } } },
              { user: { name: { contains: query } } },
              { user: { email: { contains: query } } },
              ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
            ],
          },
        ]
      : []),
  ];
  const where = { AND: [{ messages: { some: { deletedAt: null } } }, ...filters] };

  const clientWhere =
    scope === "all"
      ? { deletedAt: null }
      : { deletedAt: null, id: { in: scope.length ? scope : ["__none__"] } };

  const [threads, customers, teammates] = await Promise.all([
    prisma.smsConversation.findMany({
      where,
      include: {
        client: { select: { companyName: true, contactName: true } },
        user: { select: { name: true, email: true, role: true, deletedAt: true } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    }),
    clientId
      ? Promise.resolve([])
      : prisma.client.findMany({
          where: clientWhere,
          select: { id: true, companyName: true, phone: true, user: { select: { twoFactorPhone: true } } },
          orderBy: { companyName: "asc" },
          take: 200,
        }),
    clientId
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { deletedAt: null, role: { in: [UserRole.ADMIN, UserRole.STAFF] } },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            twoFactorPhone: true,
            staffProfile: { select: { phone: true } },
          },
          orderBy: { name: "asc" },
          take: 200,
        }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Texts"
        description={
          filteredClient
            ? `Texts from ${filteredClient.companyName}`
            : "Texts with customers and teammates, from your Voixly number."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput placeholder="Search texts…" />
            {user.role === UserRole.ADMIN && <SyncTextsButton />}
          </div>
        }
      />

      <Panel
        title={clientId ? "Text this customer" : "Text someone"}
        description="Sends from your Voixly number and shows up in their thread."
        icon={Send}
        accent="secondary"
      >
        <SendTextForm
          locked={Boolean(filteredClient)}
          recipients={[
            ...(filteredClient ? [filteredClient] : customers).map((customer) => {
              const phone =
                normalizePhone(customer.phone ?? "") ?? normalizePhone(customer.user.twoFactorPhone ?? "");
              return {
                id: customer.id,
                kind: "client" as const,
                group: "Customers",
                label: phone
                  ? `${customer.companyName} · ${formatPhone(phone)}`
                  : `${customer.companyName} · no mobile number`,
              };
            }),
            ...teammates.map((teammate) => {
              const phone =
                normalizePhone(teammate.staffProfile?.phone ?? "") ??
                normalizePhone(teammate.twoFactorPhone ?? "");
              const name = teammate.name?.trim() || teammate.email;
              const role = teammate.role === UserRole.ADMIN ? "Admin" : "Staff";
              return {
                id: teammate.id,
                kind: "user" as const,
                group: "Team",
                label: phone ? `${name} · ${role} · ${formatPhone(phone)}` : `${name} · ${role} · no mobile number`,
              };
            }),
          ]}
        />
      </Panel>

      <div className="flex flex-wrap gap-2 text-sm">
        <FilterLink href="/admin/texts" active={!clientId && !showUnlinked}>
          All
        </FilterLink>
        {user.role === UserRole.ADMIN && (
          <FilterLink href="/admin/texts?unlinked=1" active={showUnlinked}>
            Needs a customer
          </FilterLink>
        )}
      </div>

      {threads.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title={filteredClient ? "No texts from this customer yet" : "No texts yet"}
          description={
            filteredClient
              ? "When they text your Voixly number, the thread shows up here."
              : "When someone texts your Voixly number, it shows up here under their name. Use Check for texts after the inbox is turned on in Settings → SMS."
          }
        />
      ) : (
        <TextInboxList
          threads={threads.map((thread) => {
            const teammate =
              thread.user && !thread.user.deletedAt ? thread.user.name?.trim() || thread.user.email : null;
            const named = Boolean(thread.client || teammate);
            return {
              id: thread.id,
              name: thread.client?.companyName ?? teammate ?? `Unknown number · ${formatPhone(thread.phone)}`,
              preview: thread.lastPreview,
              when: formatRelativeTime(thread.lastMessageAt),
              unread: thread.unreadCount,
              needsCustomer: !thread.client && !teammate,
              phonePrefix: named ? `${formatPhone(thread.phone)} · ` : "",
            };
          })}
        />
      )}
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 transition-colors",
        active
          ? "border-primary bg-primary/10 font-medium text-foreground"
          : "border-border text-muted-foreground hover:bg-muted/60"
      )}
    >
      {children}
    </Link>
  );
}
