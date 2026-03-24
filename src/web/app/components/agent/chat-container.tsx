// Chat container — message list with smart scroll, centered empty state, and input
import { useRef, useEffect, useCallback, useState } from "react";
import { Bot } from "lucide-react";
import type { AgentMessage, AgentStatus } from "@/hooks/use-agent";
import { ChatMessage } from "./chat-message";
import { ChatInput, type ChatInputModel, type ChatInputUsage } from "./chat-input";

interface ChatContainerProps {
  messages: AgentMessage[];
  isStreaming: boolean;
  status?: AgentStatus | null;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  thinking?: boolean;
  onThinkingChange?: (v: boolean) => void;
  models?: ChatInputModel[];
  activeModelId?: string | null;
  onModelChange?: (modelId: string) => void;
  isModelLoading?: boolean;
  usage?: ChatInputUsage | null;
}

const SUGGESTIONS = [
  { title: "Monthly spending", prompt: "How much did I spend last month?" },
  { title: "Top categories", prompt: "Show my top 5 expense categories" },
  { title: "Unusual activity", prompt: "Any unusual transactions recently?" },
  { title: "Savings rate", prompt: "What's my savings rate?" },
];

// Format elapsed seconds into a readable string
function formatElapsed(startedAt: number): string {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  if (seconds < 5) return "";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

// Elapsed timer that re-renders every second
function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsed = formatElapsed(startedAt);
  if (!elapsed) return null;
  return <span className="tabular-nums text-muted-foreground/50">{elapsed}</span>;
}

export function ChatContainer({
  messages,
  isStreaming,
  status,
  disabled,
  onSend,
  onStop,
  thinking,
  onThinkingChange,
  models,
  activeModelId,
  onModelChange,
  isModelLoading,
  usage,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // Smart auto-scroll: batch to one scroll per frame to avoid flooding during streaming
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userScrolledRef.current) {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        scrollRafRef.current = null;
      });
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      userScrolledRef.current = false;
      onSend(text);
    },
    [onSend]
  );

  // Detect user scrolling away from bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledRef.current = distanceFromBottom > 100;
  }, []);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {isEmpty ? (
        // Empty state — flex-centered, takes all available space
        <div className="flex-1 flex flex-col items-center justify-center px-4 animate-fade-in">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <Bot className="h-6 w-6" />
          </div>
          <h2 className="text-base font-medium text-foreground mb-1">
            Financial Assistant
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
            Ask questions about your transactions and spending.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.prompt}
                onClick={() => handleSend(s.prompt)}
                disabled={disabled}
                className="rounded-xl border border-border bg-card hover:bg-accent/50 p-3.5 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="block text-[13px] font-medium text-foreground">
                  {s.title}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {s.prompt}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        // Scrollable message area — native overflow for reliable height behavior
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
            <div className="space-y-6">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
            </div>
            {status && isStreaming && (
              <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                <span className="animate-pulse">{status.label}</span>
                {status.iteration > 0 && (
                  <span className="text-muted-foreground/40">
                    turn {status.iteration + 1}
                  </span>
                )}
                <ElapsedTimer startedAt={status.startedAt} />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <ChatInput
        onSend={handleSend}
        onStop={onStop}
        isStreaming={isStreaming}
        disabled={disabled}
        thinking={thinking}
        onThinkingChange={onThinkingChange}
        models={models}
        activeModelId={activeModelId}
        onModelChange={onModelChange}
        isModelLoading={isModelLoading}
        usage={usage}
      />
    </div>
  );
}
