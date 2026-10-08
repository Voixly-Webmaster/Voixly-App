import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin, getStaffClientScope } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { SyncTextsButton } from "@/components/texts/text-actions";
import { formatPhone } from "@/lib/phone";
import { cn, formatRelativeTime } from "@/lib/utils";
import { UserRole } from "@prisma/client";
import { Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Texts",
  description: "Texts from customers, tied to their account.",
};

export default async function TextsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; client?: string; unlinked?: string }>;
}) {
  const user = await requireAdmin();
  const { q, client: clientId, unlinked } = await searchParams;
  const scope = await getStaffClientScope(user);
  const showUnlinked = user.role === UserRole.ADMIN && unlinked === "1" && !clientId;
  const query = q?.trim() ?? "";
  const digits = query.replace(/\D/g, "");

  const filters = [
    ...(scope === "all"
      ? []
      : [{ clientId: { in: scope.length ? scope : ["__none__"] } }]),
    ...(clientId ? [{ clientId }] : []),
    ...(showUnlinked ? [{ clientId: null }] : []),
    ...(query
      ? [
          {
            OR: [
              { lastPreview: { contains: query } },
              { client: { companyName: { contains: query } } },
              { client: { contactName: { contains: query } } },
              ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
            ],
          },
        ]
      : []),
  ];
  const where = filters.length > 0 ? { AND: filters } : {};

  const [threads, filteredClient] = await Promise.all([
    prisma.smsConversation.findMany({
      where,
      include: {
        client: { select: { companyName: true, contactName: true } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    }),
    clientId
      ? prisma.client.findFirst({
          where: { id: clientId, deletedAt: null },
          select: { companyName: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Texts"
        description={
          filteredClient
            ? `Texts from ${filteredClient.companyName}`
            : "Website changes and replies customers text to your Voixly number. Each thread stays with that customer."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput placeholder="Search texts…" />
            {user.role === UserRole.ADMIN && <SyncTextsButton />}
          </div>
        }
      />

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
              : "When a customer texts your Voixly number, it shows up here under their name. Use Check for texts after the inbox is turned on in Settings → SMS."
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          {threads.map((thread) => {
            const name =
              thread.client?.companyName ??
              `Unknown number · ${formatPhone(thread.phone)}`;
            return (
              <li key={thread.id} className="border-b border-border/60 last:border-b-0">
                <Link
                  href={`/admin/texts/${thread.id}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {name}
                      {thread.unreadCount > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          {thread.unreadCount} new
                        </span>
                      )}
                      {!thread.client && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Needs a customer
                        </span>
                      )}
                    </p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {thread.client ? `${formatPhone(thread.phone)} · ` : ""}
                      {thread.lastPreview}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(thread.lastMessageAt)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
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
