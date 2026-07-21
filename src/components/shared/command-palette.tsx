"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CreditCard,
  MessageSquare,
  CheckSquare,
  Search,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { globalSearch, type SearchHit } from "@/actions/search";

const TYPE_META: Record<
  SearchHit["type"],
  { icon: typeof Building2; label: string; color: string }
> = {
  client: { icon: Building2, label: "Client", color: "text-secondary" },
  invoice: { icon: CreditCard, label: "Invoice", color: "text-primary" },
  ticket: { icon: MessageSquare, label: "Ticket", color: "text-secondary" },
  task: { icon: CheckSquare, label: "Task", color: "text-primary" },
};

type CommandPaletteContextValue = {
  open: () => void;
};

const CommandPaletteContext = React.createContext<CommandPaletteContextValue | null>(
  null
);

export function useCommandPalette() {
  const ctx = React.useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be inside <CommandPaletteProvider>");
  return ctx;
}

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd/Ctrl+K to open
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "/" && !open) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
            target.isContentEditable)
        )
          return;
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  React.useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const hits = await globalSearch(query);
        setResults(hits);
        setActiveIdx(0);
      } catch (err) {
        console.error("[command-palette]", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const handleSelect = React.useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      setQuery("");
      router.push(hit.href);
    },
    [router]
  );

  const onListKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const hit = results[activeIdx];
      if (hit) {
        e.preventDefault();
        handleSelect(hit);
      }
    }
  };

  const value = React.useMemo(
    () => ({ open: () => setOpen(true) }),
    []
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-[20%] max-w-2xl translate-y-0 gap-0 p-0"
          hideClose
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">
            Search across clients, invoices, tickets, and tasks
          </DialogDescription>
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onListKey}
              placeholder="Search clients, invoices, tickets, tasks..."
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              aria-label="Global search"
            />
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <kbd className="hidden rounded border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block">
              ESC
            </kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {results.length === 0 && !loading && query.trim() && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No results for &quot;{query}&quot;
              </p>
            )}
            {!query.trim() && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Start typing to search across the entire workspace.
                <br />
                <span className="text-xs">
                  Press <kbd className="rounded border border-border/80 bg-muted px-1 py-0.5 font-mono">⌘K</kbd>{" "}
                  anytime to open this search.
                </span>
              </p>
            )}
            {results.map((hit, idx) => {
              const meta = TYPE_META[hit.type];
              const Icon = meta.icon;
              return (
                <button
                  key={`${hit.type}-${hit.id}`}
                  onClick={() => handleSelect(hit)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    idx === activeIdx ? "bg-muted/80" : "hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted",
                      meta.color
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{hit.title}</p>
                    {hit.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">
                        {hit.subtitle}
                      </p>
                    )}
                  </div>
                  <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </CommandPaletteContext.Provider>
  );
}
