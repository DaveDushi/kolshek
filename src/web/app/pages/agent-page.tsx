// Agent page — full-bleed chat interface that breaks out of AppShell padding
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings, RotateCcw } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAgent } from "@/hooks/use-agent";
import { ChatContainer } from "@/components/agent/chat-container";
import { ConfigPanel } from "@/components/agent/config-panel";
import { api } from "@/lib/api";

interface AiConfigResponse {
  provider: string;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
}

export function AgentPage() {
  useDocumentTitle("Agent");
  const { messages, isStreaming, send, stop, clear } = useAgent();
  const [configOpen, setConfigOpen] = useState(false);
  const [enabledSkills, setEnabledSkills] = useState<string[]>([
    "analysis",
    "categories",
    "budgeting",
    "hebrew",
  ]);

  const { data: config } = useQuery<AiConfigResponse>({
    queryKey: ["agent", "config"],
    queryFn: () => api.get("/api/v2/agent/config"),
  });

  const isConfigured = !!(config?.model);

  const handleSend = useCallback(
    (text: string) => {
      send(text, undefined, enabledSkills);
    },
    [send, enabledSkills]
  );

  // Break out of AppShell's padded container for full-bleed chat layout.
  // AppShell inner div: px-4 py-5 md:px-6 md:py-6 lg:px-8
  // AppShell main: pb-16 md:pb-0 (mobile nav)
  // Height: subtract mobile nav (4rem) on mobile, full viewport on desktop
  return (
    <div className="-mx-4 -mt-5 -mb-5 md:-mx-6 md:-mt-6 md:-mb-6 lg:-mx-8 flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Slim header */}
      <div className="flex items-center justify-between px-4 md:px-6 h-12 shrink-0 border-b border-border bg-background">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium text-foreground">
            Financial Assistant
          </span>
          {config?.model && (
            <span className="hidden sm:inline text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {config.model}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {messages.length > 0 && (
            <button
              onClick={clear}
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

      <ChatContainer
        messages={messages}
        isStreaming={isStreaming}
        disabled={!isConfigured}
        onSend={handleSend}
        onStop={stop}
      />

      <ConfigPanel
        open={configOpen}
        onOpenChange={setConfigOpen}
        enabledSkills={enabledSkills}
        onSkillsChange={setEnabledSkills}
      />
    </div>
  );
}
