import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const DEFAULT_PAGE_SIZE = 25;

export function parsePageParam(value: string | undefined): number {
  const n = parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function buildPageHref(
  pathname: string,
  search: URLSearchParams,
  page: number
): string {
  const next = new URLSearchParams(search);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  pathname,
  searchParams,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  pathname: string;
  /** Plain key/value of all current URL params (excluding page). */
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) params.set(k, v);
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Showing <span className="tabular-nums font-medium text-foreground">{start}</span>
        –<span className="tabular-nums font-medium text-foreground">{end}</span> of{" "}
        <span className="tabular-nums font-medium text-foreground">{totalItems}</span>
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <PageLink
          disabled={page <= 1}
          href={buildPageHref(pathname, params, page - 1)}
          label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </PageLink>
        <span className="px-3 text-sm tabular-nums">
          Page <strong className="text-foreground">{page}</strong> / {totalPages}
        </span>
        <PageLink
          disabled={page >= totalPages}
          href={buildPageHref(pathname, params, page + 1)}
          label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </PageLink>
      </nav>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-card text-foreground shadow-sm transition-colors";
  if (disabled) {
    return (
      <span
        aria-disabled
        aria-label={label}
        className={cn(base, "pointer-events-none opacity-40")}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      scroll={false}
      className={cn(base, "hover:bg-muted/70")}
    >
      {children}
    </Link>
  );
}
