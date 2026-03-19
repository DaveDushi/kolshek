// Chat input — floating composer with unified container (ChatGPT-style)
import { useState, useRef, useCallback } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = "Ask about your finances...",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    if (isStreaming) {
      onStop();
      return;
    }
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isStreaming, disabled, onSend, onStop]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const hasContent = value.trim().length > 0;

  return (
    <div className="shrink-0 px-4 md:px-6 pb-4 pt-2 bg-background">
      <div className="max-w-3xl mx-auto">
        <div
          className={cn(
            "relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2",
            "shadow-sm transition-[border-color,box-shadow] duration-200",
            "focus-within:border-ring/40 focus-within:shadow-md"
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Configure a provider first" : placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent px-2 py-1.5",
              "text-sm placeholder:text-muted-foreground/60",
              "focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[36px] max-h-[160px]"
            )}
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || (!isStreaming && !hasContent)}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              isStreaming
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : hasContent
                  ? "bg-foreground text-background hover:opacity-90"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {isStreaming ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground/50 mt-1.5 select-none">
          Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
