// Agent page — AI chat interface for querying financial data
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings, Trash2 } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAgent } from "@/hooks/use-agent";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
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

  // Check if a provider is configured
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      <div className="px-4 md:px-6 pt-4 pb-2">
        <PageHeader title="Agent" description="AI financial assistant">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              className="h-8 text-xs gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfigOpen(true)}
            className="h-8 text-xs gap-1.5"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Button>
        </PageHeader>
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
