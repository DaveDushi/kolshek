// Single chat message — user or assistant (ChatGPT-style layout)
import { memo } from "react";
import type { AgentMessage } from "@/hooks/use-agent";
import { ToolCallCard } from "./tool-call-card";
import { MarkdownContent } from "./markdown-content";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: AgentMessage;
}

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl bg-secondary text-secondary-foreground px-4 py-2.5 text-sm leading-relaxed">
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message — markdown-rendered, no bubble
  return (
    <div className="animate-fade-in">
      {/* Tool calls render as separate blocks above text */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {message.toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}

      {/* Markdown-rendered text content */}
      {message.content && (
        <MarkdownContent content={message.content} />
      )}

      {/* Streaming cursor */}
      {message.isStreaming && (
        <span
          className={cn(
            "inline-block w-0.5 h-[18px] bg-foreground/70 rounded-full align-middle",
            "animate-blink-cursor"
          )}
        />
      )}
    </div>
  );
});
