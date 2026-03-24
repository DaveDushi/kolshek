// Agent page — full-bleed chat interface that breaks out of AppShell padding.
// Supports workflow modes (analyze, review, categorize, translate, init) via
// slash commands or the config panel.
import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, RotateCcw, X, Loader2 } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAgent } from "@/hooks/use-agent";
import { ChatContainer } from "@/components/agent/chat-container";
import { ConfigPanel } from "@/components/agent/config-panel";
import { ModelSetup } from "@/components/agent/model-setup";
import { api } from "@/lib/api";

interface AgentConfigResponse {
  modelId: string | null;
  modelLoaded: boolean;
  modelInfo: { id: string; name: string; contextSize: number; gpuBackend: string; tier: number } | null;
  contextBounds: { min: number; max: number; current: number } | null;
}

interface ModeInfo {
  name: string;
  description: string;
}

interface ModelStatus {
  id: string;
  name: string;
  downloaded: boolean;
  loaded: boolean;
}

const LAST_MODEL_KEY = "kolshek-last-model-id";

// Mode display names
const MODE_LABELS: Record<string, string> = {
  analyze: "Financial Analysis",
  review: "Monthly Review",
  categorize: "Categorize",
  translate: "Translate",
  init: "Setup",
};

export function AgentPage() {
  useDocumentTitle("Agent");
  const queryClient = useQueryClient();
  const { messages, isStreaming, status, usage, send, stop, clear } = useAgent();
  const [configOpen, setConfigOpen] = useState(false);
  const [enabledSkills, setEnabledSkills] = useState<string[]>([
    "analysis",
    "categories",
    "budgeting",
    "hebrew",
  ]);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [contextSize, setContextSize] = useState<number | null>(null); // null = use default
  const [isModelLoading, setIsModelLoading] = useState(false);

  const { data: config, refetch: refetchConfig } = useQuery<AgentConfigResponse>({
    queryKey: ["agent", "config"],
    queryFn: () => api.get("/api/v2/agent/config"),
  });

  const { data: modes } = useQuery<ModeInfo[]>({
    queryKey: ["agent", "modes"],
    queryFn: () => api.get("/api/v2/agent/modes"),
  });

  const { data: models } = useQuery<ModelStatus[]>({
    queryKey: ["agent", "models"],
    queryFn: () => api.get("/api/v2/agent/models"),
  });

  // Downloaded models available for switching
  const downloadedModels = (models || []).filter((m) => m.downloaded);

  const isReady = !!config?.modelLoaded;

  const modelTier = config?.modelInfo?.tier ?? 1;

  // Use refs for values that change frequently but shouldn't recreate callbacks
  const enabledSkillsRef = useRef(enabledSkills);
  enabledSkillsRef.current = enabledSkills;
  const thinkingRef = useRef(thinking);
  thinkingRef.current = thinking;
  const contextSizeRef = useRef(contextSize);
  contextSizeRef.current = contextSize;

  const handleSend = useCallback(
    (text: string) => {
      const skills = enabledSkillsRef.current;
      const think = thinkingRef.current;
      const ctx = contextSizeRef.current;

      // Detect slash commands for mode activation (tier 3+ only)
      const modeMatch = text.match(/^\/(analyze|review|categorize|translate|init)$/);
      if (modeMatch && modelTier >= 3) {
        const modeName = modeMatch[1];
        setActiveMode(modeName);
        send(
          `Starting ${MODE_LABELS[modeName] || modeName} workflow. Follow the skill steps.`,
          skills,
          modeName,
          think,
          ctx ?? undefined,
        );
        return;
      }

      // Exit mode command
      if (text.trim() === "/exit" && activeMode) {
        setActiveMode(null);
        return;
      }

      send(text, skills, activeMode || undefined, think, ctx ?? undefined);
    },
    [send, activeMode, modelTier]
  );

  const handleModeStart = useCallback(
    (modeName: string) => {
      setActiveMode(modeName);
      setConfigOpen(false);
      send(
        `Starting ${MODE_LABELS[modeName] || modeName} workflow. Follow the skill steps.`,
        enabledSkillsRef.current,
        modeName,
        thinkingRef.current,
        contextSizeRef.current ?? undefined,
      );
    },
    [send]
  );

  const handleExitMode = useCallback(() => {
    setActiveMode(null);
  }, []);

  // Clear mode when chat is cleared
  const handleClear = useCallback(() => {
    clear();
    setActiveMode(null);
  }, [clear]);

  const [switchError, setSwitchError] = useState<string | null>(null);

  // Switch to a different downloaded model
  const handleModelSwitch = useCallback(async (modelId: string) => {
    setIsModelLoading(true);
    setSwitchError(null);
    try {
      await api.post("/api/v2/agent/model/load", { modelId });
      queryClient.invalidateQueries({ queryKey: ["agent", "models"] });
      refetchConfig();
      // Pre-evaluate system prompt so first message is fast
      api.post("/api/v2/agent/warmup", {}).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to switch model";
      setSwitchError(msg);
      setTimeout(() => setSwitchError(null), 5000);
    } finally {
      setIsModelLoading(false);
    }
  }, [queryClient, refetchConfig]);

  // Called when model setup completes (model downloaded + loaded)
  const handleModelReady = useCallback(() => {
    refetchConfig();
    // Pre-evaluate system prompt so first message is fast
    api.post("/api/v2/agent/warmup", {}).catch(() => {});
  }, [refetchConfig]);

  // Track last used model in localStorage
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  // Persist last model ID whenever config shows a loaded model
  useEffect(() => {
    if (config?.modelId && config.modelLoaded) {
      localStorage.setItem(LAST_MODEL_KEY, config.modelId);
    }
  }, [config?.modelId, config?.modelLoaded]);

  // Auto-load last used model on mount (navigate to /agent)
  useEffect(() => {
    if (config === undefined) return; // query hasn't resolved yet
    if (config?.modelLoaded) return; // already loaded
    const lastId = localStorage.getItem(LAST_MODEL_KEY);
    if (!lastId) return;
    // Check the model is still downloaded
    const available = (models || []).find((m) => m.id === lastId && m.downloaded);
    if (!available) return;
    handleModelSwitch(lastId);
  }, [config, models]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-unload on unmount (navigate away from /agent) unless streaming
  useEffect(() => {
    return () => {
      if (!isStreamingRef.current) {
        api.post("/api/v2/agent/model/unload", {}).catch(() => {});
      }
    };
  }, []);

  // Break out of AppShell's padded container for full-bleed chat layout.
  return (
    <div className="-mx-4 -mt-5 -mb-5 md:-mx-6 md:-mt-6 md:-mb-6 lg:-mx-8 flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Slim header */}
      <div className="flex items-center justify-between px-4 md:px-6 h-12 shrink-0 border-b border-border bg-background">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium text-foreground">
            Financial Assistant
          </span>
          {config?.modelInfo && (
            <>
              <span className="hidden sm:inline text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {config.modelInfo.name}
              </span>
              <span className={`hidden sm:inline text-[11px] px-1.5 py-0.5 rounded ${
                config.modelInfo.gpuBackend !== "cpu"
                  ? "text-emerald-700 bg-emerald-500/10"
                  : "text-amber-700 bg-amber-500/10"
              }`}>
                {config.modelInfo.gpuBackend !== "cpu"
                  ? config.modelInfo.gpuBackend.toUpperCase()
                  : "CPU"}
              </span>
            </>
          )}
          {activeMode && (
            <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">
              {MODE_LABELS[activeMode] || activeMode}
              <button
                onClick={handleExitMode}
                className="hover:text-primary/70 transition-colors"
                title="Exit mode"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="New chat"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setConfigOpen(true)}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Model switch error */}
      {switchError && (
        <div role="alert" className="mx-4 md:mx-6 mt-2 rounded-lg border border-red-500/20 bg-red-500/8 p-2 text-xs text-red-700 dark:text-red-400">
          {switchError}
        </div>
      )}

      {/* Show loading screen during auto-load, setup wizard if no model, or chat */}
      {isModelLoading && !isReady ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 animate-fade-in">
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Loading model...</p>
        </div>
      ) : !isReady ? (
        <ModelSetup onReady={handleModelReady} />
      ) : (
        <ChatContainer
          messages={messages}
          isStreaming={isStreaming}
          status={status}
          disabled={false}
          onSend={handleSend}
          onStop={stop}
          thinking={thinking}
          onThinkingChange={setThinking}
          models={downloadedModels.map((m) => ({ id: m.id, name: m.name, loaded: m.loaded }))}
          activeModelId={config?.modelId ?? null}
          onModelChange={handleModelSwitch}
          isModelLoading={isModelLoading}
          usage={usage}
        />
      )}

      <ConfigPanel
        open={configOpen}
        onOpenChange={setConfigOpen}
        enabledSkills={enabledSkills}
        onSkillsChange={setEnabledSkills}
        modes={modelTier >= 3 ? (modes || []) : []}
        onModeStart={handleModeStart}
        onModelChange={refetchConfig}
        contextBounds={config?.contextBounds ?? null}
        contextSize={contextSize}
        onContextSizeChange={setContextSize}
      />
    </div>
  );
}
