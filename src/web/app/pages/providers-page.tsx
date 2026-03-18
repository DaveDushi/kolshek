// Providers management page — grid of connected providers with sync and
// add-connection wizard
import { useState, useCallback } from "react";
import { Plus, Unplug, RefreshCw, ChevronDown, Eye } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProviderGrid } from "@/components/providers/provider-grid";
import { AddProviderWizard } from "@/components/providers/add-provider-wizard";
import { SyncPanel } from "@/components/layout/sync-panel";
import { UpdateAuthDialog } from "@/components/providers/update-auth-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useProviders, useDeleteProvider } from "@/hooks/use-providers";
import { useSync } from "@/hooks/use-sync";
import { Skeleton } from "@/components/ui/skeleton";

export function ProvidersPage() {
  useDocumentTitle("Providers");
  const { data: providers, isLoading, isError, error } = useProviders();
  const deleteProvider = useDeleteProvider();
  const { events, isRunning, start } = useSync();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [authTarget, setAuthTarget] = useState<number | null>(null);

  const handleSync = useCallback((options?: { providerId?: number; visible?: boolean }) => {
    setSyncPanelOpen(true);
    const provider = options?.providerId
      ? providers?.find((p) => p.id === options.providerId)
      : undefined;
    start({
      providers: options?.providerId ? [options.providerId] : undefined,
      providerNames: provider ? [provider.displayName] : undefined,
      visible: options?.visible,
    });
  }, [start, providers]);

  const handleDelete = useCallback(
    (id: number) => {
      deleteProvider.mutate(id);
    },
    [deleteProvider]
  );

  const handleAuth = useCallback((id: number) => {
    setAuthTarget(id);
  }, []);

  const handleRetrySync = useCallback(() => {
    start();
  }, [start]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description="Manage your bank and credit card connections."
      >
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSync()}
            disabled={isRunning || !providers?.length}
            className="rounded-r-none"
          >
            <RefreshCw className={isRunning ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Sync All
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isRunning || !providers?.length}
                className="rounded-l-none border-l-0 px-1.5"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleSync({ visible: true })}>
                <Eye className="h-4 w-4" />
                Sync All (visible)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button size="sm" onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Connection
        </Button>
      </PageHeader>

      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load providers:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-3 rounded-xl border p-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-32" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : !providers?.length ? (
        <EmptyState
          icon={<Unplug />}
          title="No bank connections"
          description="Add your first bank or credit card to start tracking your finances."
          action={{
            label: "Add Connection",
            onClick: () => setWizardOpen(true),
          }}
        />
      ) : (
        <ProviderGrid
          providers={providers}
          onSync={handleSync}
          onDelete={handleDelete}
          onAuth={handleAuth}
          isSyncing={isRunning}
        />
      )}

      {/* Reopen sync panel when closed but sync data exists */}
      {!syncPanelOpen && events.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 z-50 shadow-md"
          onClick={() => setSyncPanelOpen(true)}
        >
          <RefreshCw className={isRunning ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {isRunning ? "Syncing..." : "Sync Results"}
        </Button>
      )}

      {/* Update auth dialog */}
      <UpdateAuthDialog
        provider={providers?.find((p) => p.id === authTarget) ?? null}
        open={authTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAuthTarget(null);
        }}
      />

      {/* Add provider wizard */}
      <AddProviderWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Sync progress panel */}
      <SyncPanel
        open={syncPanelOpen}
        onOpenChange={setSyncPanelOpen}
        events={events}
        isRunning={isRunning}
        onRetry={handleRetrySync}
      />
    </div>
  );
}
