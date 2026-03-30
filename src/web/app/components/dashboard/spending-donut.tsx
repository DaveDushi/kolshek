// Spending donut chart -- top categories for the current month
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ShoppingCart } from "lucide-react";
import { useSpending } from "@/hooks/use-spending";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Muted, sophisticated color palette -- works in both light and dark
const CHART_COLORS = [
  "#6366f1", // indigo -- primary
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#ec4899", // pink
  "#84cc16", // lime
  "#d946ef", // fuchsia
];

const OTHER_COLOR = "#71717a"; // zinc-500

function SpendingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <ShoppingCart className="h-3.5 w-3.5" />
          Spending
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mx-auto flex h-44 w-44 items-center justify-center">
          <Skeleton className="h-36 w-36 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}

interface LegendItemProps {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

function LegendItem({ name, amount, percentage, color }: LegendItemProps) {
  return (
    <div className="flex items-center justify-between py-1 text-[13px]">
      <div className="flex items-center gap-2 truncate min-w-0">
        <div
          className="h-2 w-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color }}
        />
        <span className="truncate text-foreground">{name}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <span className="tabular-nums font-medium">
          {formatCurrency(amount)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// Custom tooltip for the donut chart
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <p className="text-[13px] font-medium">{item.name}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {formatCurrency(item.amount)} ({item.percentage.toFixed(1)}%)
      </p>
    </div>
  );
}

export function SpendingDonut() {
  const currentMonth = getCurrentMonth();
  const { data, isLoading, isError } = useSpending(currentMonth, "category");

  // Take the top 5 categories, bundle the rest into "Other"
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sorted = data.toSorted((a, b) => b.amount - a.amount);
    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5);

    const items = top5.map((item, i) => ({
      name: item.name || "Uncategorized",
      amount: item.amount,
      percentage: item.percentage,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

    if (rest.length > 0) {
      const otherAmount = rest.reduce((sum, r) => sum + r.amount, 0);
      const otherPct = rest.reduce((sum, r) => sum + r.percentage, 0);
      items.push({
        name: "Other",
        amount: otherAmount,
        percentage: otherPct,
        color: OTHER_COLOR,
      });
    }

    return items;
  }, [data]);

  if (isLoading) {
    return <SpendingSkeleton />;
  }

  if (isError || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <ShoppingCart className="h-3.5 w-3.5" />
            Spending
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No spending data for this month yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalSpending = chartData.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <ShoppingCart className="h-3.5 w-3.5" />
          Spending by Category
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Donut chart with total in center */}
        <div className="relative h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="85%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-base font-bold tabular-nums tracking-display">
              {formatCurrency(totalSpending)}
            </span>
          </div>
        </div>
        {/* Legend */}
        <div className="space-y-0">
          {chartData.map((item) => (
            <LegendItem
              key={item.name}
              name={item.name}
              amount={item.amount}
              percentage={item.percentage}
              color={item.color}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
