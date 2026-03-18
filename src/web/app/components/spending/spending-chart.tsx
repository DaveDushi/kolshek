// Horizontal bar chart showing spending breakdown by category/merchant/provider
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { SpendingItem } from "@/types/api";

interface SpendingChartProps {
  items: SpendingItem[];
}

// Color palette for chart bars
const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // purple
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#ec4899", // pink
  "#84cc16", // lime
  "#d946ef", // fuchsia
];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SpendingItem }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-medium">{item.name}</p>
      <p className="text-sm text-muted-foreground">
        {formatCurrency(item.amount)} ({item.percentage.toFixed(1)}%)
      </p>
      <p className="text-xs text-muted-foreground">{item.count} transactions</p>
    </div>
  );
}

export function SpendingChart({ items }: SpendingChartProps) {
  // Limit to top 15 for readability
  const chartData = items.slice(0, 15);
  const chartHeight = Math.max(300, chartData.length * 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatCurrency(v)}
          className="text-xs"
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
          {chartData.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
