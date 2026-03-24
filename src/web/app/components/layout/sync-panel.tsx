// Sync progress panel — shows per-provider sync status in a Sheet
import { useMemo } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Square,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SyncEvent } from "@/types/api";

interface SyncPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: SyncEvent[];
  isRunning: boolean;
  onRetry: () => void;
  onCancel?: () => void;
}

// Derive per-provider status from the flat event stream
interface ProviderStatus {
  name: string;
  stage: string;
  progress: number; // 0-100
  status: "queued" | "running" | "done" | "error";
  added: number;
  updated: number;
  error: string | null;
}

// Map known stage names to approximate progress percentages
const STAGE_PROGRESS: Record<string, number> = {
  "logging in": 20,
  "waiting for OTP": 30,
  "entering OTP": 40,
  "fetching accounts": 50,
  "fetching transactions": 70,
  "saving": 90,
  "done": 100,
};

function deriveProviderStatuses(events: SyncEvent[]): ProviderStatus[] {
  const map = new Map<string, ProviderStatus>();

  for (const evt of events) {
    // "queued" event shows providers waiting for the current sync to finish
    if (evt.type === "queued" && evt.providers) {
      for (const name of evt.providers) {
        if (!map.has(name)) {
          map.set(name, {
            name,
            stage: "queued",
            progress: 0,
            status: "queued",
            added: 0,
            updated: 0,
            error: null,
          });
        }
      }
      continue;
    }

    // "start" event initializes all providers so they appear immediately
    if (evt.type === "start" && evt.providers) {
      for (const name of evt.providers) {
        // Remove any queued entry that matches (case-insensitive) —
        // the queued name may be the displayName while the server uses the alias
        for (const [key, val] of map) {
          if (val.status === "queued" && key.toLowerCase() === name.toLowerCase()) {
            map.delete(key);
          }
        }
        map.set(name, {
          name,
          stage: "connecting...",
          progress: 0,
          status: "running",
          added: 0,
          updated: 0,
          error: null,
        });
      }
      continue;
    }

    if (!evt.provider) continue;

    const existing = map.get(evt.provider);
    const base: ProviderStatus = existing || {
      name: evt.provider,
      stage: "",
      progress: 0,
      status: "running",
      added: 0,
      updated: 0,
      error: null,
    };

    if (evt.type === "progress" && evt.stage) {
      base.stage = evt.stage;
      const knownProgress = STAGE_PROGRESS[evt.stage.toLowerCase()];
      if (knownProgress !== undefined) {
        base.progress = knownProgress;
      } else if (base.progress < 10) {
        base.progress = 10;
      }
    }

    if (evt.type === "result") {
      base.status = evt.success === false ? "error" : "done";
      base.progress = 100;
      base.stage = evt.success === false ? "failed" : "done";
      base.added = evt.added ?? 0;
      base.updated = evt.updated ?? 0;
      if (evt.error) base.error = evt.error;
    }

    if (evt.type === "error" && evt.provider) {
      base.status = "error";
      base.error = evt.error || evt.message || "Unknown error";
      base.stage = "error";
    }

    map.set(evt.provider, base);
  }

  return Array.from(map.values());
}

function ProviderRow({ provider }: { provider: ProviderStatus }) {
  return (
    <div className="space-y-2 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{provider.name}</span>
        <div className="flex items-center gap-1.5">
          {provider.status === "queued" && (
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {provider.status === "running" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {provider.status === "done" && (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          )}
          {provider.status === "error" && (
            <XCircle className="h-3.5 w-3.5 text-destructive" />
          )}
          <span
            className={cn(
              "text-xs",
              provider.status === "error"
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            {provider.stage || "starting..."}
          </span>
        </div>
      </div>
      <Progress value={provider.progress} className="h-1.5" />
      {provider.status === "done" && (provider.added > 0 || provider.updated > 0) && (
        <p className="text-xs text-muted-foreground">
          {provider.added > 0 && `${provider.added} added`}
          {provider.added > 0 && provider.updated > 0 && ", "}
          {provider.updated > 0 && `${provider.updated} updated`}
        </p>
      )}
      {provider.status === "error" && provider.error && (
        <p className="text-xs text-destructive">{provider.error}</p>
      )}
    </div>
  );
}

export function SyncPanel({
  open,
  onOpenChange,
  events,
  isRunning,
  onRetry,
  onCancel,
}: SyncPanelProps) {
  const providers = useMemo(() => deriveProviderStatuses(events), [events]);

  const globalError = events.find(
    (e) => e.type === "error" && !e.provider
  );
  const isDone = events.some((e) => e.type === "done");

  const totals = useMemo(() => {
    let added = 0;
    let updated = 0;
    for (const p of providers) {
      added += p.added;
      updated += p.updated;
    }
    return { added, updated };
  }, [providers]);

  const hasErrors = providers.some((p) => p.status === "error");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <RefreshCw
              className={cn("h-4 w-4", isRunning && "animate-spin")}
            />
            Sync Progress
          </SheetTitle>
          <SheetDescription>
            {isRunning
              ? "Fetching latest transactions from your providers..."
              : isDone
                ? "Sync complete"
                : "Ready to sync"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {providers.length === 0 && !globalError && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {isRunning
                ? "Connecting to providers..."
                : "No sync data yet. Start a sync to see progress."}
            </p>
          )}

          {globalError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 my-2" role="alert">
              <p className="text-sm text-destructive font-medium">Sync Error</p>
              <p className="text-xs text-destructive/80 mt-1">
                {globalError.error || globalError.message}
              </p>
            </div>
          )}

          {providers.map((provider) => (
            <div key={provider.name}>
              <ProviderRow provider={provider} />
              <Separator />
            </div>
          ))}
        </ScrollArea>

        {isRunning && onCancel && (
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onCancel}
            >
              <Square className="h-3.5 w-3.5 mr-1.5" />
              Cancel Sync
            </Button>
          </div>
        )}

        {isDone && (
          <div className="pt-4 border-t space-y-3">
            <div className="text-sm text-center">
              {hasErrors ? (
                <span className="text-destructive">
                  Some providers failed to sync
                </span>
              ) : totals.added === 0 && totals.updated === 0 ? (
                <span className="text-muted-foreground">
                  Everything is up to date
                </span>
              ) : (
                <span>
                  <span className="font-medium">{totals.added}</span> new,{" "}
                  <span className="font-medium">{totals.updated}</span> updated
                </span>
              )}
            </div>
            {hasErrors && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onRetry}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Retry Failed
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
