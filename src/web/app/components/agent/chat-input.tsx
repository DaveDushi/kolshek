// Chat input — floating composer with unified container (ChatGPT-style)
// Includes Think toggle and model switcher below the composer.
import { useState, useRef, useCallback } from "react";
import { ArrowUp, Square, Brain, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatInputModel {
  id: string;
  name: string;
  loaded: boolean;
}

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  thinking?: boolean;
  onThinkingChange?: (v: boolean) => void;
  models?: ChatInputModel[];
  activeModelId?: string | null;
  onModelChange?: (modelId: string) => void;
  isModelLoading?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = "Ask about your finances...",
  thinking,
  onThinkingChange,
  models,
  activeModelId,
  onModelChange,
  isModelLoading,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
  const activeModel = models?.find((m) => m.id === activeModelId);
  const hasMultipleModels = models && models.length > 1;

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

        {/* Bottom bar: Think toggle + Model switcher + hint */}
        <div className="flex items-center justify-between mt-1.5 px-1">
          <div className="flex items-center gap-2">
            {/* Think toggle */}
            {onThinkingChange && (
              <button
                onClick={() => onThinkingChange(!thinking)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  thinking
                    ? "bg-violet-500/15 text-violet-700 dark:text-violet-400"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                title={thinking
                  ? "Thinking ON — slower but may improve reasoning. Click to disable."
                  : "Thinking OFF (recommended for small models). Click to enable."}
              >
                <Brain className="h-3 w-3" />
                {thinking ? "Think" : "No Think"}
              </button>
            )}

            {/* Model switcher */}
            {hasMultipleModels && (
              <div className="relative">
                <button
                  onClick={() => setModelMenuOpen((v) => !v)}
                  disabled={isModelLoading}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    "bg-muted text-muted-foreground hover:bg-muted/80",
                    isModelLoading && "opacity-60 cursor-wait"
                  )}
                >
                  <span className="max-w-[120px] truncate">
                    {isModelLoading ? "Loading..." : (activeModel?.name || "Select model")}
                  </span>
                  <ChevronDown className={cn("h-3 w-3 transition-transform", modelMenuOpen && "rotate-180")} />
                </button>

                {modelMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setModelMenuOpen(false)}
                    />
                    {/* Dropdown */}
                    <div
                      ref={menuRef}
                      className="absolute bottom-full left-0 mb-1 z-50 min-w-[200px] rounded-lg border border-border bg-card shadow-md py-1 animate-fade-in"
                    >
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            if (model.id !== activeModelId) {
                              onModelChange?.(model.id);
                            }
                            setModelMenuOpen(false);
                          }}
                          disabled={isModelLoading}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors",
                            "hover:bg-accent/50",
                            model.id === activeModelId && "text-foreground font-medium",
                            model.id !== activeModelId && "text-muted-foreground"
                          )}
                        >
                          <span className="flex-1 truncate">{model.name}</span>
                          {model.id === activeModelId && (
                            <Check className="h-3 w-3 text-primary shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground/50 select-none">
            Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
