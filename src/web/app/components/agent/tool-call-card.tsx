// Tool call — compact inline pill with expandable details (ChatGPT-style)
import { useState, memo } from "react";
import { ChevronDown, ChevronRight, Check, Loader2 } from "lucide-react";
import type { AgentToolCall } from "@/hooks/use-agent";
import { cn } from "@/lib/utils";

interface ToolCallCardProps {
  toolCall: AgentToolCall;
}

// Human-readable labels for tool names
const TOOL_LABELS: Record<string, string> = {
  query: "Querying database",
  get_schema: "Reading schema",
  monthly_report: "Generating report",
  run_command: "Running command",
};

// Brief summary of the tool result for collapsed view
function summarizeResult(name: string, result?: string): string {
  if (result === undefined) return "";
  if (result === "") return "Done";
  try {
    const parsed = JSON.parse(result);
    if (parsed.error) return `Error: ${parsed.error}`;
    if (parsed.tables) return `${parsed.count ?? parsed.tables.length} table(s)`;
    if (parsed.rows) return `${parsed.count ?? parsed.rows.length} row(s)`;
    if (parsed.success !== undefined) return parsed.message || "Done";
    if (Array.isArray(parsed)) return `${parsed.length} result(s)`;
    return "Done";
  } catch {
    return result.length > 40 ? result.slice(0, 37) + "..." : result;
  }
}

function humanLabel(name: string): string {
  return TOOL_LABELS[name] || name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ToolCallCard = memo(function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLoading = toolCall.result === undefined;
  const summary = summarizeResult(toolCall.name, toolCall.result);

  return (
    <div className="inline-flex flex-col">
      {/* Compact pill */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
          "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          isLoading ? "bg-muted/60" : "bg-muted/40"
        )}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Check className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" />
        )}
        <span className="text-muted-foreground">
          {isLoading ? humanLabel(toolCall.name) + "..." : humanLabel(toolCall.name)}
        </span>
        {!isLoading && summary && (
          <span className="text-muted-foreground/70">{summary}</span>
        )}
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/60 ml-0.5" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60 ml-0.5" />
        )}
      </button>

      {/* Expandable details */}
      {expanded && (
        <div className="mt-2 rounded-lg bg-muted/30 border border-border p-3 space-y-2 text-xs max-w-xl">
          {toolCall.arguments && toolCall.arguments !== "{}" && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                Arguments
              </p>
              <pre className="overflow-x-auto rounded bg-surface-sunken p-2 text-[11px] text-foreground whitespace-pre-wrap break-all">
                {formatJson(toolCall.arguments)}
              </pre>
            </div>
          )}
          {toolCall.result && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                Result
              </p>
              <pre className="overflow-x-auto rounded bg-surface-sunken p-2 text-[11px] text-foreground whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                {formatJson(toolCall.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
