// Sync schedule page — configure automatic syncing and view sync history
import { useState, useCallback } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Power,
  PowerOff,
  CalendarClock,
  History,
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useSchedule, useEnableSchedule, useDisableSchedule } from "@/hooks/use-schedule";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { formatRelativeTime, formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SyncLogEntry } from "@/types/api";

function formatTimeUntil(dateStr: string): string {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  const diffMs = target - now;
  if (diffMs <= 0) return "Any moment now";
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Less than a minute";
  if (diffMins < 60) return `In ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `In ${diffHours}h ${diffMins % 60}m`;
  const diffDays = Math.floor(diffHours / 24);
  return `In ${diffDays}d ${diffHours % 24}h`;
}

const INTERVAL_OPTIONS = [
  { value: "1", label: "Every hour" },
  { value: "2", label: "Every 2 hours" },
  { value: "4", label: "Every 4 hours" },
  { value: "6", label: "Every 6 hours" },
  { value: "12", label: "Every 12 hours" },
  { value: "24", label: "Every 24 hours" },
  { value: "48", label: "Every 2 days" },
  { value: "168", label: "Every week" },
  { value: "custom", label: "Custom..." },
];

const PRESET_VALUES = new Set(INTERVAL_OPTIONS.map((o) => o.value).filter((v) => v !== "custom"));

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "-";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return "<1s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  return remainSec > 0 ? `${minutes}m ${remainSec}s` : `${minutes}m`;
}

function SyncHistoryRow({ entry }: { entry: SyncLogEntry }) {
  const isError = entry.status === "error";

  return (
    <TableRow>
      <TableCell className="font-medium text-sm">
        {entry.providerDisplayName}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {isError ? (
            <XCircle className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          )}
          <span
            className={cn(
              "text-xs",
              isError ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {isError ? "Failed" : "Success"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground cursor-default">
              {formatRelativeTime(entry.startedAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent>{formatFullDate(entry.startedAt)}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDuration(entry.startedAt, entry.completedAt)}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {isError ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-destructive cursor-default truncate max-w-[200px] inline-block">
                {entry.errorMessage || "Unknown error"}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              {entry.errorMessage || "Unknown error"}
            </TooltipContent>
          </Tooltip>
        ) : entry.transactionsAdded > 0 || entry.transactionsUpdated > 0 ? (
          <>
            {entry.transactionsAdded > 0 && `+${entry.transactionsAdded}`}
            {entry.transactionsAdded > 0 && entry.transactionsUpdated > 0 && ", "}
            {entry.transactionsUpdated > 0 && `${entry.transactionsUpdated} updated`}
          </>
        ) : (
          "Up to date"
        )}
      </TableCell>
    </TableRow>
  );
}

export function SchedulePage() {
  useDocumentTitle("Sync Schedule");

  const { data, isLoading, isError, error } = useSchedule();
  const enableSchedule = useEnableSchedule();
  const disableSchedule = useDisableSchedule();

  const isRegistered = data?.schedule.registered ?? false;
  const currentInterval = data?.schedule.intervalHours;

  // For the interval selector — default to current interval or 6h
  const [selectedInterval, setSelectedInterval] = useState<string | null>(null);
  const [customH, setCustomH] = useState("");
  const [customM, setCustomM] = useState("");

  // Determine if current config uses a preset or is custom
  const currentIsPreset = currentInterval
    ? PRESET_VALUES.has(String(currentInterval)) && Number.isInteger(currentInterval)
    : true;

  // What the select dropdown shows
  const selectValue = selectedInterval
    ?? (currentIsPreset ? String(currentInterval ?? "6") : "custom");

  // The actual hours value to submit (fractional, e.g. 1.5 = 1h30m)
  const isCustom = selectValue === "custom";
  const customTotalMinutes = (Number(customH) || 0) * 60 + (Number(customM) || 0);
  const resolvedHours = isCustom
    ? customTotalMinutes > 0 ? customTotalMinutes / 60 : (currentInterval && !currentIsPreset ? currentInterval : 0)
    : Number(selectValue);

  const customValid = isCustom
    ? customTotalMinutes >= 5 && customTotalMinutes <= 10080 // 5 min – 168h
    : true;
  const customTouched = isCustom && (customH !== "" || customM !== "");

  const handleSelectChange = useCallback((value: string) => {
    setSelectedInterval(value);
    if (value !== "custom") {
      setCustomH("");
      setCustomM("");
    } else if (currentInterval && !currentIsPreset) {
      // Pre-fill with current custom interval
      const totalMin = Math.round(currentInterval * 60);
      setCustomH(String(Math.floor(totalMin / 60)));
      setCustomM(String(totalMin % 60));
    }
  }, [currentInterval, currentIsPreset]);

  const handleEnable = useCallback(() => {
    if (!customValid) return;
    enableSchedule.mutate(resolvedHours);
    setSelectedInterval(null);
    setCustomH("");
    setCustomM("");
  }, [enableSchedule, resolvedHours, customValid]);

  const handleUpdate = useCallback(() => {
    if (!customValid) return;
    if (resolvedHours !== currentInterval) {
      enableSchedule.mutate(resolvedHours);
      setSelectedInterval(null);
      setCustomH("");
      setCustomM("");
    }
  }, [enableSchedule, resolvedHours, currentInterval, customValid]);

  const handleDisable = useCallback(() => {
    disableSchedule.mutate();
    setSelectedInterval(null);
  }, [disableSchedule]);

  const isMutating = enableSchedule.isPending || disableSchedule.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sync Schedule"
        description="Configure automatic data syncing and view sync history."
      />

      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load schedule:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {/* Missed runs warning */}
      {data && data.missedRuns > 0 && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {data.missedRuns} scheduled sync{data.missedRuns > 1 ? "s" : ""} may have been missed
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This can happen if the computer was off or asleep during scheduled sync times.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Schedule configuration card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" />
              Schedule Configuration
            </CardTitle>
            <CardDescription>
              Automatically sync your bank and credit card data on a schedule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-8 w-32" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status indicator */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      isRegistered ? "bg-green-500" : "bg-muted-foreground/40"
                    )}
                  />
                  <span className="text-sm font-medium">
                    {isRegistered ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Interval selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Sync interval
                  </label>
                  <Select
                    value={selectValue}
                    onValueChange={handleSelectChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isCustom && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          type="number"
                          min={0}
                          max={168}
                          placeholder="0"
                          value={customH}
                          onChange={(e) => setCustomH(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          placeholder="0"
                          value={customM}
                          onChange={(e) => setCustomM(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground">min</span>
                      </div>
                    </div>
                  )}
                  {isCustom && customTouched && !customValid && (
                    <p className="text-xs text-destructive">
                      Minimum 5 minutes, maximum 168 hours.
                    </p>
                  )}
                </div>

                {/* Schedule details when active */}
                {isRegistered && data?.schedule && (
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {data.schedule.nextRunAt && (
                      <div className="flex justify-between">
                        <span>Next run</span>
                        <span className="font-medium text-foreground">
                          {formatTimeUntil(data.schedule.nextRunAt)}
                        </span>
                      </div>
                    )}
                    {data.schedule.registeredAt && (
                      <div className="flex justify-between">
                        <span>Registered</span>
                        <span>{formatFullDate(data.schedule.registeredAt)}</span>
                      </div>
                    )}
                    {data.schedule.platform && (
                      <div className="flex justify-between">
                        <span>Platform</span>
                        <span className="capitalize">{data.schedule.platform}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  {isRegistered ? (
                    <>
                      {resolvedHours !== currentInterval && customValid && (
                        <Button
                          size="sm"
                          onClick={handleUpdate}
                          disabled={isMutating}
                        >
                          Update Interval
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisable}
                        disabled={isMutating}
                        className="text-destructive hover:text-destructive"
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                        Disable
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleEnable}
                      disabled={isMutating || (isCustom && !customValid)}
                    >
                      <Power className="h-3.5 w-3.5" />
                      Enable Schedule
                    </Button>
                  )}
                </div>

                {/* Mutation error */}
                {(enableSchedule.isError || disableSchedule.isError) && (
                  <p className="text-xs text-destructive">
                    {enableSchedule.error?.message || disableSchedule.error?.message}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync history card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Sync History
            </CardTitle>
            <CardDescription>
              Recent sync runs and their results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : !data?.syncHistory.length ? (
              <EmptyState
                icon={<Clock />}
                title="No sync history"
                description="Sync history will appear here after your first data sync."
                className="py-8"
              />
            ) : (
              <div className="overflow-x-auto -mx-6 px-6 max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="text-xs">Provider</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Duration</TableHead>
                      <TableHead className="text-xs">Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.syncHistory.map((entry) => (
                      <SyncHistoryRow key={entry.id} entry={entry} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
