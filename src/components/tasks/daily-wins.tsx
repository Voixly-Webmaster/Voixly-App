"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Target, Plus, Trash2, CheckCircle2, ChevronDown } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import {
  createDailyWin,
  deleteDailyWin,
  getDailyWins,
  toggleDailyWin,
} from "@/actions/daily-wins";
import { todayKey } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

export type DailyWinItem = {
  id: string;
  text: string;
  goalDate: string;
  userId: string;
  completed: boolean;
  user: { id: string; name: string | null; email: string };
};

type StaffOption = { id: string; name: string | null; email: string };

export function DailyWins({
  goalDate,
  currentUserId,
  staff,
  isAdmin,
  initialWins = [],
}: {
  goalDate: string;
  currentUserId: string;
  staff: StaffOption[];
  isAdmin: boolean;
  initialWins?: DailyWinItem[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [wins, setWins] = useState<DailyWinItem[]>(initialWins);
  const [loading, setLoading] = useState(false);
  const [newText, setNewText] = useState("");
  const [viewUserId, setViewUserId] = useState(currentUserId);

  const effectiveDate = goalDate === "all" ? todayKey() : goalDate;
  const canAdd = viewUserId === currentUserId;

  const loadWins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDailyWins(effectiveDate, viewUserId);
      setWins(data);
    } catch (err) {
      console.error("[DailyWins]", err);
      setWins([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveDate, viewUserId]);

  useEffect(() => {
    loadWins();
  }, [loadWins]);

  const refresh = () =>
    startTransition(() => {
      router.refresh();
      loadWins();
    });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    try {
      await createDailyWin(newText, effectiveDate);
      setNewText("");
      refresh();
    } catch (err) {
      toast.error(
        "Could not add win",
        err instanceof Error ? err.message : undefined
      );
    }
  };

  const handleDelete = async (winId: string) => {
    const ok = await confirm({
      title: "Delete this win?",
      tone: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteDailyWin(winId);
        refresh();
      } catch (err) {
        toast.error(
          "Could not delete win",
          err instanceof Error ? err.message : undefined
        );
      }
    });
  };

  const active = wins.filter((w) => !w.completed);
  const completed = wins.filter((w) => w.completed);
  const viewUser = staff.find((s) => s.id === viewUserId);

  const subtitle = `Close-out goals for ${format(parseISO(effectiveDate + "T12:00:00"), "MMMM d, yyyy")}${
    isAdmin && viewUser ? ` · ${viewUser.name ?? viewUser.email}` : " · only you can edit these"
  }`;

  return (
    <Panel
      title="Daily Wins"
      description={subtitle}
      icon={Target}
      accent="primary"
      className={cn("mb-6", isPending && "opacity-70")}
      action={
        isAdmin ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="win-member" className="text-xs whitespace-nowrap">
              View wins for
            </Label>
            <select
              id="win-member"
              value={viewUserId}
              onChange={(e) => setViewUserId(e.target.value)}
              className="flex h-9 min-w-[140px] rounded-lg border border-input bg-background px-2 text-sm shadow-sm"
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id === currentUserId ? "My wins" : s.name ?? s.email}
                </option>
              ))}
            </select>
          </div>
        ) : undefined
      }
    >

      {canAdd && (
        <form onSubmit={handleCreate} className="mb-4 flex gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add a close-out win for today..."
            className="flex-1"
          />
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" /> Add win
          </Button>
        </form>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Loading daily wins...
        </p>
      ) : wins.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No wins set for this day yet.
        </p>
      ) : (
        <>
          {active.length > 0 && (
            <ul className="space-y-2">
              {active.map((win) => (
                <WinRow
                  key={win.id}
                  win={win}
                  editable={win.userId === currentUserId}
                  onToggle={() => {
                    startTransition(async () => {
                      await toggleDailyWin(win.id, true);
                      refresh();
                    });
                  }}
                  onDelete={() => handleDelete(win.id)}
                />
              ))}
            </ul>
          )}

          {completed.length > 0 && (
            <details className="mt-4 group">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Completed wins ({completed.length})
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-3 space-y-2 border-t pt-3">
                {completed.map((win) => (
                  <WinRow
                    key={win.id}
                    win={win}
                    completed
                    editable={win.userId === currentUserId}
                    onToggle={() => {
                      startTransition(async () => {
                        await toggleDailyWin(win.id, false);
                        refresh();
                      });
                    }}
                    onDelete={() => handleDelete(win.id)}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Panel>
  );
}

function WinRow({
  win,
  editable,
  completed,
  onToggle,
  onDelete,
}: {
  win: DailyWinItem;
  editable: boolean;
  completed?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5",
        completed && "opacity-75"
      )}
    >
      <input
        type="checkbox"
        checked={win.completed}
        onChange={onToggle}
        disabled={!editable}
        className="h-4 w-4 accent-primary"
        title={editable ? "Mark complete" : "Only creator can edit"}
      />
      <span
        className={cn(
          "flex-1 text-sm",
          completed && "line-through text-muted-foreground"
        )}
      >
        {win.text}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {win.user.name ?? win.user.email}
      </span>
      {editable && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      )}
    </li>
  );
}
