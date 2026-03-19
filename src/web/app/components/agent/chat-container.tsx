// Chat container — message list with auto-scroll, empty state, and input
import { useRef, useEffect } from "react";
import { Bot, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AgentMessage } from "@/hooks/use-agent";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";

interface ChatContainerProps {
  messages: AgentMessage[];
  isStreaming: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

const SUGGESTIONS = [
  "How much did I spend last month?",
  "Show my top 5 expense categories",
  "Any unusual transactions recently?",
  "What's my savings rate?",
];

export function ChatContainer({
  messages,
  isStreaming,
  disabled,
  onSend,
  onStop,
}: ChatContainerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or content streams
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-6 animate-fade-in">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bot className="h-7 w-7" />
              </div>
              <div className="text-center space-y-1.5">
                <h2 className="text-lg font-semibold text-foreground">
                  Financial Assistant
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Ask questions about your transactions, spending, and financial data.
                  The agent queries your local database to find answers.
                </p>
              </div>

              {/* Suggestion chips */}
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => onSend(suggestion)}
                    disabled={disabled}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="h-3 w-3" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <ChatInput
        onSend={onSend}
        onStop={onStop}
        isStreaming={isStreaming}
        disabled={disabled}
      />
    </div>
  );
}
