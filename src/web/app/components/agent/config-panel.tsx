// AI agent config panel — model management + skills + workflows
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useModelDownload } from "@/hooks/use-model-download";
import { Check, Loader2, HardDrive, Cpu, Download, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ModeInfo {
  name: string;
  description: string;
}

interface ContextBounds {
  min: number;
  max: number;
  current: number;
}

interface ConfigPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledSkills: string[];
  onSkillsChange: (skills: string[]) => void;
  modes?: ModeInfo[];
  onModeStart?: (mode: string) => void;
  onModelChange?: () => void;
  contextBounds: ContextBounds | null;
  contextSize: number | null;
  onContextSizeChange: (size: number | null) => void;
}

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
  description: string;
  tier: number;
  downloaded: boolean;
  loaded: boolean;
  recommended: boolean;
  compatible: boolean;
  incompatibleReason?: string;
}

interface SkillInfo {
  name: string;
  filename: string;
  description?: string;
  tier?: string;
}

// Mode display names
const MODE_LABELS: Record<string, string> = {
  analyze: "Financial Analysis",
  review: "Monthly Review",
  categorize: "Categorize Transactions",
  translate: "Translate Descriptions",
  init: "Initial Setup",
};

const TIER_LABELS: Record<number, string> = {
  1: "Lightweight",
  2: "Standard",
  3: "Performance",
  4: "Powerhouse",
};

function formatSize(bytes: number): string {
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
  return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
}

// Context size slider step presets (powers of 2 for clean values)
const CTX_STEPS = [2048, 4096, 8192, 16384, 32768, 65536];

function formatCtx(n: number): string {
  return n >= 1024 ? `${Math.round(n / 1024)}K` : String(n);
}

export function ConfigPanel({
  open,
  onOpenChange,
  enabledSkills,
  onSkillsChange,
  modes,
  onModeStart,
  onModelChange,
  contextBounds,
  contextSize,
  onContextSizeChange,
}: ConfigPanelProps) {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: hardware } = useQuery<HardwareInfo>({
    queryKey: ["agent", "hardware"],
    queryFn: () => api.get("/api/v2/agent/hardware"),
    enabled: open,
  });

  const { data: models, refetch: refetchModels } = useQuery<ModelStatus[]>({
    queryKey: ["agent", "models"],
    queryFn: () => api.get("/api/v2/agent/models"),
    enabled: open,
  });

  const { data: skills } = useQuery<SkillInfo[]>({
    queryKey: ["agent", "skills"],
    queryFn: () => api.get("/api/v2/agent/skills"),
  });

  const { downloadingId, downloadProgress, download: handleDownload } = useModelDownload({
    onComplete: async () => {
      await refetchModels();
    },
    onError: (msg) => setError(msg),
  });

  const toggleSkill = useCallback(
    (name: string) => {
      if (enabledSkills.includes(name)) {
        onSkillsChange(enabledSkills.filter((s) => s !== name));
      } else {
        onSkillsChange([...enabledSkills, name]);
      }
    },
    [enabledSkills, onSkillsChange]
  );

  // Load a model
  const handleLoad = useCallback(async (modelId: string) => {
    setLoadingId(modelId);
    setError(null);
    try {
      await api.post("/api/v2/agent/model/load", { modelId });
      await refetchModels();
      queryClient.invalidateQueries({ queryKey: ["agent", "config"] });
      onModelChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load model");
    } finally {
      setLoadingId(null);
    }
  }, [refetchModels, queryClient, onModelChange]);

  // Delete a model
  const handleDelete = useCallback(async (modelId: string) => {
    setError(null);
    try {
      await fetch(`/api/v2/agent/models/${modelId}`, {
        method: "DELETE",
        credentials: "include",
      });
      await refetchModels();
      queryClient.invalidateQueries({ queryKey: ["agent", "config"] });
      onModelChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete model");
    }
  }, [refetchModels, queryClient, onModelChange]);

  // Group downloaded/loaded models at top
  const loadedModel = models?.find((m) => m.loaded);
  const downloadedModels = models?.filter((m) => m.downloaded && !m.loaded) || [];
  const availableModels = models?.filter((m) => !m.downloaded) || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] sm:w-[420px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="text-base">Settings</SheetTitle>
          <SheetDescription className="text-xs">
            Local model management and agent configuration
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 pb-6 space-y-6">
            {/* Error banner */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-2.5 text-xs text-red-700 dark:text-red-400 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-2 underline text-[11px]">dismiss</button>
              </div>
            )}

            {/* --- Model section --- */}
            <section className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Model
              </p>

              {/* Hardware summary */}
              {hardware && (
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    {hardware.totalRamGB} GB RAM
                  </span>
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3" />
                    {hardware.cpu.cores} cores
                  </span>
                  {hardware.gpu && (
                    <span>
                      {hardware.gpu.name}
                      {hardware.gpu.vramGB ? ` ${hardware.gpu.vramGB} GB` : ""}
                    </span>
                  )}
                </div>
              )}

              {/* Active model */}
              {loadedModel && (
                <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
                  <div>
                    <p className="text-xs font-medium">{loadedModel.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {loadedModel.params} {loadedModel.quant} — Active
                    </p>
                  </div>
                  <Badge variant="default" className="text-[9px] h-4 bg-green-600">
                    Loaded
                  </Badge>
                </div>
              )}

              {/* Downloaded but not loaded */}
              {downloadedModels.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                  {downloadedModels.map((model) => (
                    <div key={model.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-xs font-medium">{model.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {model.params} — Downloaded
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px]"
                          disabled={loadingId === model.id}
                          onClick={() => handleLoad(model.id)}
                        >
                          {loadingId === model.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : "Load"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => handleDelete(model.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Available models (grouped by tier) */}
              {availableModels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground">
                    Available models — download to use
                  </p>
                  {Object.entries(
                    availableModels.reduce((acc, m) => {
                      if (!acc[m.tier]) acc[m.tier] = [];
                      acc[m.tier].push(m);
                      return acc;
                    }, {} as Record<number, ModelStatus[]>)
                  )
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([tier, tierModels]) => (
                      <div key={tier}>
                        <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40 mb-1">
                          {TIER_LABELS[Number(tier)] || `Tier ${tier}`}
                        </p>
                        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                          {tierModels.map((model) => {
                            const isActive = downloadingId === model.id;
                            return (
                              <div
                                key={model.id}
                                className={cn(
                                  "px-3 py-2 space-y-1.5",
                                  !model.compatible && "opacity-40",
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium">{model.name}</span>
                                    <span className="text-[9px] text-muted-foreground font-mono">
                                      {model.params}
                                    </span>
                                    {model.recommended && (
                                      <Badge variant="secondary" className="text-[8px] h-3.5 px-1">
                                        Best fit
                                      </Badge>
                                    )}
                                  </div>
                                  {model.compatible ? (
                                    <Button
                                      variant={model.recommended ? "default" : "outline"}
                                      size="sm"
                                      className="h-6 text-[10px]"
                                      disabled={!!downloadingId}
                                      onClick={() => handleDownload(model.id)}
                                    >
                                      {isActive ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      ) : (
                                        <Download className="h-3 w-3 mr-1" />
                                      )}
                                      {isActive ? `${downloadProgress}%` : formatSize(model.sizeBytes)}
                                    </Button>
                                  ) : (
                                    <span className="text-[9px] text-muted-foreground">
                                      {model.incompatibleReason}
                                    </span>
                                  )}
                                </div>
                                {isActive && <Progress value={downloadProgress} className="h-1" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>

            {/* --- Workflows section --- */}
            {modes && modes.length > 0 && onModeStart && (
              <section className="space-y-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    Workflows
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Guided multi-step financial workflows. Also available via slash commands (e.g. /analyze).
                  </p>
                </div>

                <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                  {modes.map((mode) => (
                    <div
                      key={mode.name}
                      className="flex items-center justify-between px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-xs font-medium text-foreground">
                          {MODE_LABELS[mode.name] || mode.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          /{mode.name}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] shrink-0"
                        onClick={() => onModeStart(mode.name)}
                      >
                        Start
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* --- Skills section --- */}
            <section className="space-y-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  Skills
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Domain knowledge loaded on-demand by the assistant.
                </p>
              </div>

              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                {skills?.map((skill) => {
                  const isActive = enabledSkills.includes(skill.name);
                  return (
                    <button
                      key={skill.name}
                      onClick={() => toggleSkill(skill.name)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors",
                        "hover:bg-accent/50",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border shrink-0 transition-colors",
                          isActive
                            ? "bg-primary border-primary"
                            : "border-border"
                        )}
                      >
                        {isActive && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="capitalize">{skill.name}</span>
                        {skill.description && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{skill.description}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* --- Advanced section --- */}
            {contextBounds && (
              <section className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  Advanced
                </p>

                {(() => {
                  const steps = CTX_STEPS.filter((s) => s >= contextBounds.min && s <= contextBounds.max);
                  const effective = contextSize ?? contextBounds.current;
                  // Find closest step index
                  let closestIdx = 0;
                  let closestDist = Infinity;
                  for (let i = 0; i < steps.length; i++) {
                    const d = Math.abs(steps[i] - effective);
                    if (d < closestDist) { closestDist = d; closestIdx = i; }
                  }
                  return (
                    <div className="rounded-lg border border-border px-3 py-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-foreground">Context window</p>
                        <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                          {formatCtx(steps[closestIdx])}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={steps.length - 1}
                        value={closestIdx}
                        onChange={(e) => {
                          const val = steps[Number(e.target.value)];
                          onContextSizeChange(val === contextBounds.current ? null : val);
                        }}
                        className="w-full h-1.5 accent-primary cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground/50">
                        {steps.map((s) => (
                          <span key={s}>{formatCtx(s)}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Larger context uses more VRAM and slows inference.
                        {contextSize != null && contextSize !== contextBounds.current && (
                          <span className="text-amber-600 ml-1">
                            Changed from default ({formatCtx(contextBounds.current)}) — takes effect on next message.
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })()}
              </section>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
