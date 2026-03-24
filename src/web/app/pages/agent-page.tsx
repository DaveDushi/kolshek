// Agent page — full-bleed chat interface that breaks out of AppShell padding.
// Supports workflow modes (analyze, review, categorize, translate, init) via
// slash commands or the config panel.
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings, RotateCcw, X, Brain } from "lucide-react";
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
}

interface ModeInfo {
  name: string;
  description: string;
}

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

  const { data: config, refetch: refetchConfig } = useQuery<AgentConfigResponse>({
    queryKey: ["agent", "config"],
    queryFn: () => api.get("/api/v2/agent/config"),
  });

  const { data: modes } = useQuery<ModeInfo[]>({
    queryKey: ["agent", "modes"],
    queryFn: () => api.get("/api/v2/agent/modes"),
  });

  const isReady = !!config?.modelLoaded;

  const modelTier = config?.modelInfo?.tier ?? 1;

  const handleSend = useCallback(
    (text: string) => {
      // Detect slash commands for mode activation (tier 3+ only)
      const modeMatch = text.match(/^\/(analyze|review|categorize|translate|init)$/);
      if (modeMatch && modelTier >= 3) {
        const modeName = modeMatch[1];
        setActiveMode(modeName);
        send(
          `Starting ${MODE_LABELS[modeName] || modeName} workflow. Follow the skill steps.`,
          enabledSkills,
          modeName,
          thinking,
        );
        return;
      }

      // Exit mode command
      if (text.trim() === "/exit" && activeMode) {
        setActiveMode(null);
        return;
      }

      send(text, enabledSkills, activeMode || undefined, thinking);
    },
    [send, enabledSkills, activeMode, modelTier, thinking]
  );

  const handleModeStart = useCallback(
    (modeName: string) => {
      setActiveMode(modeName);
      setConfigOpen(false);
      send(
        `Starting ${MODE_LABELS[modeName] || modeName} workflow. Follow the skill steps.`,
        enabledSkills,
        modeName,
        thinking,
      );
    },
    [send, enabledSkills, thinking]
  );

  const handleExitMode = useCallback(() => {
    setActiveMode(null);
  }, []);

  // Clear mode when chat is cleared
  const handleClear = useCallback(() => {
    clear();
    setActiveMode(null);
  }, [clear]);

  // Called when model setup completes (model downloaded + loaded)
  const handleModelReady = useCallback(() => {
    refetchConfig();
  }, [refetchConfig]);

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
              <button
                onClick={() => setThinking((v) => !v)}
                className={`hidden sm:inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                  thinking
                    ? "text-violet-700 bg-violet-500/15"
                    : "text-muted-foreground bg-muted hover:bg-muted/80"
                }`}
                title={thinking
                  ? "Thinking ON — slower but may improve reasoning. Click to disable."
                  : "Thinking OFF (recommended for small models). Click to enable."}
              >
                <Brain className="h-3 w-3" />
                {thinking ? "Think" : "No Think"}
              </button>
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
          {/* Context usage meter */}
          {usage && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      usage.contextUsed / usage.contextMax > 0.8
                        ? "bg-amber-500"
                        : usage.contextUsed / usage.contextMax > 0.95
                          ? "bg-red-500"
                          : "bg-primary/60"
                    }`}
                    style={{ width: `${Math.min(100, Math.round(usage.contextUsed / usage.contextMax * 100))}%` }}
                  />
                </div>
                <span className="tabular-nums">
                  {Math.round(usage.contextUsed / usage.contextMax * 100)}%
                </span>
              </div>
              {usage.tokPerSec > 0 && (
                <span className="text-muted-foreground/50 tabular-nums">
                  {usage.tokPerSec} t/s
                </span>
              )}
            </div>
          )}

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

      {/* Show model setup wizard if no model is loaded, otherwise show chat */}
      {!isReady ? (
        <ModelSetup onReady={handleModelReady} />
      ) : (
        <ChatContainer
          messages={messages}
          isStreaming={isStreaming}
          status={status}
          disabled={false}
          onSend={handleSend}
          onStop={stop}
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
      />
    </div>
  );
}
