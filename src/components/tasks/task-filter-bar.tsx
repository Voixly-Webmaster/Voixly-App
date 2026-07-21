"use client";

import {
  Calendar,
  Grid3X3,
  List,
  Plus,
  Search,
  User,
  Building2,
} from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/lib/ui";
import { todayKey, tomorrowKey } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

type StaffOption = { id: string; name: string | null; email: string };
type ClientOption = { id: string; companyName: string };

export function TaskFilterBar({
  selectedDate,
  setSelectedDate,
  filterByUser,
  setFilterByUser,
  filterByClient,
  setFilterByClient,
  searchText,
  setSearchText,
  viewMode,
  setViewMode,
  onCreateTask,
  staff,
  clients,
  isAdmin,
  currentUserId,
  openTaskCount,
}: {
  selectedDate: string;
  setSelectedDate: (v: string) => void;
  filterByUser: string;
  setFilterByUser: (v: string) => void;
  filterByClient: string;
  setFilterByClient: (v: string) => void;
  searchText: string;
  setSearchText: (v: string) => void;
  viewMode: "grid" | "list";
  setViewMode: (v: "grid" | "list") => void;
  onCreateTask: () => void;
  staff: StaffOption[];
  clients: ClientOption[];
  isAdmin: boolean;
  currentUserId: string;
  openTaskCount: number;
}) {
  const datePreset =
    selectedDate === "all"
      ? "all"
      : selectedDate === todayKey()
        ? "today"
        : selectedDate === tomorrowKey()
          ? "tomorrow"
          : "custom";

  return (
    <Panel
      title="Task filters"
      description={`${openTaskCount} open tasks assigned to you`}
      accent="secondary"
      className="mb-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="space-y-1.5 min-w-[160px]">
          <Label className="text-xs flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Date
          </Label>
          <select
            value={datePreset}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "all") setSelectedDate("all");
              else if (v === "today") setSelectedDate(todayKey());
              else if (v === "tomorrow") setSelectedDate(tomorrowKey());
              else setSelectedDate(todayKey());
            }}
            className={selectClassName}
          >
            <option value="all">All open tasks</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="custom">Custom date</option>
          </select>
          {datePreset === "custom" && (
            <Input
              type="date"
              value={selectedDate === "all" ? todayKey() : selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-1.5 min-w-[160px]">
          <Label className="text-xs flex items-center gap-1">
            <User className="h-3 w-3" /> User
          </Label>
          <select
            value={isAdmin ? filterByUser : currentUserId}
            onChange={(e) => setFilterByUser(e.target.value)}
            disabled={!isAdmin}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-60"
          >
            {isAdmin ? (
              <>
                <option value="all">All users</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? s.email}
                  </option>
                ))}
              </>
            ) : (
              <option value={currentUserId}>My tasks</option>
            )}
          </select>
        </div>

        <div className="space-y-1.5 min-w-[160px]">
          <Label className="text-xs flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Client
          </Label>
          <select
            value={filterByClient}
            onChange={(e) => setFilterByClient(e.target.value)}
            className={selectClassName}
          >
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <Label className="text-xs flex items-center gap-1">
            <Search className="h-3 w-3" /> Search
          </Label>
          <Input
            placeholder="Search tasks..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex rounded-lg border p-0.5">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm",
                viewMode === "grid" && "bg-primary text-primary-foreground"
              )}
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" /> Grid
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm",
                viewMode === "list" && "bg-primary text-primary-foreground"
              )}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" /> List
            </button>
          </div>
          <Button onClick={onCreateTask}>
            <Plus className="h-4 w-4" /> Add task
          </Button>
        </div>
      </div>
    </Panel>
  );
}
