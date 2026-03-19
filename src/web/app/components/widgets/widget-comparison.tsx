// Widget: comparison -- side-by-side metric comparison with delta
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
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

function formatValue(value: number, format?: string, currency?: string): string {
  switch (format) {
    case "currency":
      return formatCurrency(value, currency || "ILS");
    case "percent":
      return `${value.toFixed(1)}%`;
    case "integer":
      return Math.round(value).toLocaleString();
    default:
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
}

function ComparisonSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-7 w-24" />
          </div>
          <Skeleton className="h-6 w-16" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WidgetComparison({ config, data }: WidgetProps) {
  const title = config.title as string | undefined;
  const leftKey = config.leftKey as string | undefined;
  const rightKey = config.rightKey as string | undefined;
  const leftLabel = (config.leftLabel as string) || "Current";
  const rightLabel = (config.rightLabel as string) || "Previous";
  const format = config.format as string | undefined;
  const currency = config.currency as string | undefined;
  // "higher_is_better" controls which direction is green vs red
  const higherIsBetter = config.higherIsBetter !== false;

  // Loading state
  if (data === undefined) {
    return <ComparisonSkeleton />;
  }

  // Resolve values
  const rawLeft = leftKey ? resolvePath(data, leftKey) : undefined;
  const rawRight = rightKey ? resolvePath(data, rightKey) : undefined;
  const leftValue = typeof rawLeft === "number" ? rawLeft : Number(rawLeft);
  const rightValue = typeof rawRight === "number" ? rawRight : Number(rawRight);
  const leftValid = !Number.isNaN(leftValue);
  const rightValid = !Number.isNaN(rightValue);

  // Calculate delta
  const absDiff = leftValid && rightValid ? leftValue - rightValue : 0;
  const pctChange =
    leftValid && rightValid && rightValue !== 0
      ? ((leftValue - rightValue) / Math.abs(rightValue)) * 100
      : 0;

  // Determine if the change is "good"
  const isPositive = absDiff > 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;
  const isNeutral = absDiff === 0;

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="flex items-center gap-4">
          {/* Left metric */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{leftLabel}</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight truncate">
              {leftValid ? formatValue(leftValue, format, currency) : "--"}
            </p>
          </div>

          {/* Delta arrow */}
          {leftValid && rightValid && !isNeutral && (
            <div
              className={cn(
                "flex flex-col items-center shrink-0 rounded-lg px-3 py-2",
                isGood
                  ? "bg-emerald-500/10"
                  : "bg-red-500/10",
              )}
            >
              <svg
                viewBox="0 0 16 16"
                className={cn(
                  "h-4 w-4",
                  isGood
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                  isPositive ? "" : "rotate-180",
                )}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M8 12V4M8 4L4 8M8 4l4 4" />
              </svg>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums mt-0.5",
                  isGood
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {Math.abs(pctChange).toFixed(1)}%
              </span>
            </div>
          )}

          {/* Right metric */}
          <div className="flex-1 min-w-0 text-right">
            <p className="text-xs text-muted-foreground truncate">{rightLabel}</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight truncate">
              {rightValid ? formatValue(rightValue, format, currency) : "--"}
            </p>
          </div>
        </div>

        {/* Absolute difference */}
        {leftValid && rightValid && !isNeutral && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Difference:{" "}
            <span
              className={cn(
                "font-medium",
                isGood
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {isPositive ? "+" : ""}
              {formatValue(absDiff, format, currency)}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
