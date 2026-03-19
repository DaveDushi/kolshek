// Widget: metric-card -- single KPI display with optional comparison
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

// Resolve a numeric value from data using a dotted key path
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

// Format a value based on the requested format type
function formatValue(
  value: number,
  format: string | undefined,
  currency?: string,
): string {
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

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-20" />
      </CardContent>
    </Card>
  );
}

export default function WidgetMetricCard({ config, data }: WidgetProps) {
  const title = (config.title as string) || "Metric";
  const valueKey = config.valueKey as string | undefined;
  const format = config.format as string | undefined;
  const currency = config.currency as string | undefined;
  const comparisonKey = config.comparisonKey as string | undefined;
  // "higher_is_better" (default true) controls color logic
  const higherIsBetter = config.higherIsBetter !== false;

  // Loading state -- no data yet
  if (data === undefined) {
    return <MetricCardSkeleton />;
  }

  // Resolve the primary value
  const rawValue = valueKey ? resolvePath(data, valueKey) : data;
  const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
  const isValid = !Number.isNaN(numericValue);

  // Resolve comparison value (previous period, target, etc.)
  const rawComparison = comparisonKey ? resolvePath(data, comparisonKey) : undefined;
  const comparisonValue =
    rawComparison != null ? Number(rawComparison) : undefined;
  const hasComparison =
    comparisonValue != null && !Number.isNaN(comparisonValue) && comparisonValue !== 0;

  // Calculate change percentage
  let changePct = 0;
  if (hasComparison && isValid) {
    changePct = ((numericValue - comparisonValue) / Math.abs(comparisonValue)) * 100;
  }

  // Determine if the change is "good" or "bad"
  const isPositiveChange = changePct > 0;
  const isGood = higherIsBetter ? isPositiveChange : !isPositiveChange;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold tabular-nums tracking-tight">
            {isValid ? formatValue(numericValue, format, currency) : "--"}
          </span>
          {hasComparison && changePct !== 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
                isGood
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400",
              )}
            >
              <svg
                viewBox="0 0 12 12"
                className={cn(
                  "h-3 w-3",
                  isPositiveChange ? "" : "rotate-180",
                )}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M6 9V3M6 3L3 6M6 3l3 3" />
              </svg>
              {Math.abs(changePct).toFixed(1)}%
            </span>
          )}
        </div>
        {hasComparison && (
          <p className="mt-1 text-xs text-muted-foreground">
            vs {formatValue(comparisonValue, format, currency)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
