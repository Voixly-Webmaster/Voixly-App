import { EmptyState } from "@/components/shared/empty-state";
import { Inbox } from "lucide-react";

export function DataTable({
  headers,
  children,
  emptyMessage = "No results found.",
}: {
  headers: string[];
  children: React.ReactNode;
  emptyMessage?: string;
}) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  if (isEmpty) {
    return <EmptyState icon={Inbox} title={emptyMessage} />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm shadow-elevated">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-gradient-to-r from-muted/50 to-muted/20">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function DataTableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={`transition-colors hover:bg-muted/30 ${className ?? ""}`}
    >
      {children}
    </tr>
  );
}

export function DataTableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-5 py-3.5 align-middle ${className ?? ""}`}>{children}</td>;
}
