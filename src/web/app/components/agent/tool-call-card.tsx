// Collapsible card showing a tool call (name, arguments, result)
import { useState } from "react";
import { ChevronDown, ChevronRight, Database, Loader2 } from "lucide-react";
import type { AgentToolCall } from "@/hooks/use-agent";
import { cn } from "@/lib/utils";

interface ToolCallCardProps {
  toolCall: AgentToolCall;
}

// Brief summary of the tool result for collapsed view
function summarizeResult(name: string, result?: string): string {
  if (result === undefined) return "Running...";
  if (result === "") return "Done (empty)";
  try {
    const parsed = JSON.parse(result);
    if (parsed.error) return `Error: ${parsed.error}`;
    if (parsed.tables) return `${parsed.count ?? parsed.tables.length} table(s)`;
    if (parsed.rows) return `${parsed.count ?? parsed.rows.length} row(s)`;
    if (parsed.success !== undefined) return parsed.message || "Done";
    if (Array.isArray(parsed)) return `${parsed.length} result(s)`;
    return "Done";
  } catch {
    return result.length > 60 ? result.slice(0, 57) + "..." : result;
  }
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLoading = toolCall.result === undefined;

  return (
    <div className="my-1.5 rounded-lg border border-border bg-surface-sunken overflow-hidden text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
          "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        )}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="font-medium text-foreground">{toolCall.name}</span>
        <span className="flex-1 text-muted-foreground truncate">
          {summarizeResult(toolCall.name, toolCall.result)}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {toolCall.arguments && toolCall.arguments !== "{}" && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                Arguments
              </p>
              <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[11px] text-foreground whitespace-pre-wrap break-all">
                {formatJson(toolCall.arguments)}
              </pre>
            </div>
          )}
          {toolCall.result && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                Result
              </p>
              <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[11px] text-foreground whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                {formatJson(toolCall.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
