// Widget: alert -- conditional alert that shows when a threshold is met
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "./widget-registry.js";

// Resolve a value from data by key path
function resolvePath(obj: unknown, path: string): unknown {
  if (obj == null || !path) return undefined;
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

// Evaluate the threshold condition
function evaluateCondition(
  value: number,
  operator: string,
  threshold: number,
): boolean {
  switch (operator) {
    case "gt":
    case ">":
      return value > threshold;
    case "gte":
    case ">=":
      return value >= threshold;
    case "lt":
    case "<":
      return value < threshold;
    case "lte":
    case "<=":
      return value <= threshold;
    case "eq":
    case "==":
      return value === threshold;
    case "neq":
    case "!=":
      return value !== threshold;
    default:
      return false;
  }
}

// Severity levels
type Severity = "info" | "warning" | "error";

// Map severity to Alert variant
function severityToVariant(severity: Severity): "default" | "destructive" {
  if (severity === "error") return "destructive";
  return "default";
}

// Severity icon (inline SVGs to avoid extra deps)
function SeverityIcon({ severity }: { severity: Severity }) {
  const className = cn(
    "h-4 w-4 shrink-0",
    severity === "error"
      ? "text-destructive"
      : severity === "warning"
        ? "text-amber-500"
        : "text-blue-500",
  );

  if (severity === "error") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
      </svg>
    );
  }
  if (severity === "warning") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
        <path d="M7.134 1.503a1 1 0 011.732 0l6.25 10.833A1 1 0 0114.25 14H1.75a1 1 0 01-.866-1.5L7.134 1.503zM8 5a.75.75 0 00-.75.75v2.5a.75.75 0 001.5 0v-2.5A.75.75 0 008 5zm0 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
      </svg>
    );
  }
  // info
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.75a.75.75 0 011.5 0v.5a.75.75 0 01-1.5 0v-.5zM7.25 7a.75.75 0 011.5 0v4.25a.75.75 0 01-1.5 0V7z" />
    </svg>
  );
}

// Format a value for display in the message
function formatVal(value: number, format?: string, currency?: string): string {
  switch (format) {
    case "currency":
      return formatCurrency(value, currency || "ILS");
    case "percent":
      return `${value.toFixed(1)}%`;
    default:
      return value.toLocaleString();
  }
}

// Interpolate {{value}} and {{threshold}} in message template
function interpolateMessage(
  template: string,
  value: number,
  threshold: number,
  format?: string,
  currency?: string,
): string {
  return template
    .replace(/\{\{value\}\}/g, formatVal(value, format, currency))
    .replace(/\{\{threshold\}\}/g, formatVal(threshold, format, currency));
}

function AlertSkeleton() {
  return (
    <Card>
      <CardContent className="pt-5">
        <Skeleton className="h-12 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export default function WidgetAlert({ config, data }: WidgetProps) {
  const valueKey = config.valueKey as string | undefined;
  const operator = (config.operator as string) || "gt";
  const threshold = config.threshold as number | undefined;
  const severity = (config.severity as Severity) || "info";
  const title = config.title as string | undefined;
  const message = (config.message as string) || "Alert triggered.";
  const format = config.format as string | undefined;
  const currency = config.currency as string | undefined;

  // Loading state
  if (data === undefined) {
    return <AlertSkeleton />;
  }

  // Resolve value
  const rawValue = valueKey ? resolvePath(data, valueKey) : data;
  const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);

  // Cannot evaluate without a valid value and threshold
  if (Number.isNaN(numericValue) || threshold == null) {
    return null;
  }

  // Only show when the condition is met
  if (!evaluateCondition(numericValue, operator, threshold)) {
    return null;
  }

  const displayMessage = interpolateMessage(
    message,
    numericValue,
    threshold,
    format,
    currency,
  );

  return (
    <Alert variant={severityToVariant(severity)}>
      <SeverityIcon severity={severity} />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{displayMessage}</AlertDescription>
    </Alert>
  );
}
