// Model setup wizard — shown when no model is loaded.
// Detects hardware, recommends a model, lets user download and load it.
import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Check, HardDrive, Cpu, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface HardwareInfo {
  totalRamGB: number;
  availableRamGB: number;
  cpu: { name: string; cores: number; arch: string };
  gpu: { name: string; vramGB?: number } | null;
}

interface ModelStatus {
  id: string;
  name: string;
  sizeBytes: number;
  params: string;
  quant: string;
  minRamGB: number;
  contextWindow: number;
  toolCalling: string;
  description: string;
  tier: number;
  downloaded: boolean;
  loaded: boolean;
  recommended: boolean;
  compatible: boolean;
  incompatibleReason?: string;
}

interface ModelSetupProps {
  onReady: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
  return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
}

const TIER_LABELS: Record<number, string> = {
  1: "Lightweight",
  2: "Standard",
  3: "Performance",
  4: "Powerhouse",
};

export function ModelSetup({ onReady }: ModelSetupProps) {
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data: hardware } = useQuery<HardwareInfo>({
    queryKey: ["agent", "hardware"],
    queryFn: () => api.get("/api/v2/agent/hardware"),
  });

  const { data: models, refetch: refetchModels } = useQuery<ModelStatus[]>({
    queryKey: ["agent", "models"],
    queryFn: () => api.get("/api/v2/agent/models"),
  });

  // Find recommended model
  const recommendedModel = models?.find((m) => m.recommended);
  const hasDownloaded = models?.some((m) => m.downloaded);

  // Download a model via SSE progress stream
  const handleDownload = useCallback(async (modelId: string) => {
    setDownloadingId(modelId);
    setDownloadProgress(0);
    setError(null);

    try {
      const res = await fetch("/api/v2/agent/models/download", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Download failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            try {
              const event = JSON.parse(trimmed.slice(5).trim());
              if (event.type === "progress") {
                setDownloadProgress(event.percent || 0);
              } else if (event.type === "done") {
                setDownloadProgress(100);
              } else if (event.type === "error") {
                throw new Error(event.message || "Download failed");
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Download failed") continue;
              throw e;
            }
          }
        }
      }

      // Download complete — refresh model list then auto-load
      await refetchModels();
      // Load the model into memory
      setLoadingId(modelId);
      try {
        await api.post("/api/v2/agent/model/load", { modelId });
        queryClient.invalidateQueries({ queryKey: ["agent"] });
        onReady();
      } catch (loadErr) {
        setError(loadErr instanceof Error ? loadErr.message : "Failed to load model");
      } finally {
        setLoadingId(null);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("cancelled")) return;
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  }, [refetchModels, queryClient, onReady]);

  // Load a downloaded model
  const handleLoad = useCallback(async (modelId: string) => {
    setLoadingId(modelId);
    setError(null);
    try {
      await api.post("/api/v2/agent/model/load", { modelId });
      queryClient.invalidateQueries({ queryKey: ["agent"] });
      onReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load model");
    } finally {
      setLoadingId(null);
    }
  }, [queryClient, onReady]);

  // Delete a downloaded model
  const handleDelete = useCallback(async (modelId: string) => {
    try {
      await fetch(`/api/v2/agent/models/${modelId}`, {
        method: "DELETE",
        credentials: "include",
      });
      refetchModels();
    } catch {
      // ignore
    }
  }, [refetchModels]);

  // Group models by tier for display
  const modelsByTier = (models || []).reduce((acc, m) => {
    if (!acc[m.tier]) acc[m.tier] = [];
    acc[m.tier].push(m);
    return acc;
  }, {} as Record<number, ModelStatus[]>);

  // Determine which models to show
  const visibleModels = showAll
    ? models || []
    : models?.filter((m) => m.recommended || m.downloaded || m.compatible) || [];

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* Hardware info card */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Your Hardware
          </p>
          {hardware ? (
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <HardDrive className="h-3.5 w-3.5" />
                <span>{hardware.totalRamGB} GB RAM</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" />
                <span>{hardware.cpu.cores} cores</span>
              </div>
              {hardware.gpu && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="text-[10px] font-mono bg-muted px-1 py-0.5 rounded">GPU</span>
                  <span>
                    {hardware.gpu.name}
                    {hardware.gpu.vramGB ? ` ${hardware.gpu.vramGB} GB` : ""}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Detecting hardware...
            </div>
          )}
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-base font-medium">Choose a Model</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Download a local AI model to get started. Everything runs on your device — no API keys or cloud services needed.
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-3 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Model list by tier */}
        <div className="space-y-4">
          {Object.entries(modelsByTier)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([tier, tierModels]) => {
              const tierNum = Number(tier);
              const filteredModels = tierModels.filter((m) =>
                showAll || m.recommended || m.downloaded || m.compatible
              );
              if (filteredModels.length === 0) return null;

              return (
                <div key={tier} className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    {TIER_LABELS[tierNum] || `Tier ${tier}`}
                  </p>
                  <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                    {filteredModels.map((model) => (
                      <ModelCard
                        key={model.id}
                        model={model}
                        isDownloading={downloadingId === model.id}
                        downloadProgress={downloadingId === model.id ? downloadProgress : 0}
                        isLoading={loadingId === model.id}
                        onDownload={handleDownload}
                        onLoad={handleLoad}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Show all / show less toggle */}
        {models && models.length > (visibleModels?.length || 0) && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show recommended only" : `Show all ${models.length} models`}
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}

// Individual model card
function ModelCard({
  model,
  isDownloading,
  downloadProgress,
  isLoading,
  onDownload,
  onLoad,
  onDelete,
}: {
  model: ModelStatus;
  isDownloading: boolean;
  downloadProgress: number;
  isLoading: boolean;
  onDownload: (id: string) => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isActive = isDownloading || isLoading;

  return (
    <div
      className={cn(
        "px-3 py-3 space-y-2",
        !model.compatible && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{model.name}</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {model.params} {model.quant}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {model.description}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">
              {formatSize(model.sizeBytes)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {model.minRamGB}+ GB RAM
            </span>
            {model.recommended && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                Recommended
              </Badge>
            )}
            {model.loaded && (
              <Badge variant="default" className="text-[9px] h-4 px-1.5 bg-green-600">
                Active
              </Badge>
            )}
            {model.compatible && model.incompatibleReason && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                {model.incompatibleReason}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!model.compatible ? (
            <span className="text-[10px] text-muted-foreground">
              {model.incompatibleReason}
            </span>
          ) : model.loaded ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : model.downloaded ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                disabled={isActive}
                onClick={() => onLoad(model.id)}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Load"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                disabled={isActive}
                onClick={() => onDelete(model.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <Button
              variant={model.recommended ? "default" : "outline"}
              size="sm"
              className="h-7 text-[11px]"
              disabled={isActive || !model.compatible}
              onClick={() => onDownload(model.id)}
            >
              {isDownloading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Download className="h-3 w-3 mr-1" />
              )}
              {isDownloading ? `${downloadProgress}%` : `Download (${formatSize(model.sizeBytes)})`}
            </Button>
          )}
        </div>
      </div>

      {/* Download progress bar */}
      {isDownloading && (
        <Progress value={downloadProgress} className="h-1.5" />
      )}
    </div>
  );
}
