// Line chart for per-category spending trend with MoM change annotations
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceDot,
} from "recharts";
import { formatCurrency, formatMonth } from "@/lib/format";
import type { CategoryTrend } from "@/types/api";

interface CategoryTrendProps {
  data: CategoryTrend[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: CategoryTrend }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-1 font-medium">{label ? formatMonth(label + "-01") : ""}</p>
      <p className="text-sm">{formatCurrency(item.totalAmount)}</p>
      {item.change !== null && (
        <p className={`text-xs ${item.change > 0 ? "text-red-500" : "text-green-500"}`}>
          {item.change > 0 ? "+" : ""}{item.change.toFixed(1)}% MoM
        </p>
      )}
    </div>
  );
}

export function CategoryTrend({ data }: CategoryTrendProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="month"
          tickFormatter={(v: string) => {
            const d = new Date(v + "-01");
            return d.toLocaleDateString("en-US", { month: "short" });
          }}
          className="text-xs"
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrency(v)}
          className="text-xs"
          width={80}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="totalAmount"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        {// Annotate significant MoM changes (>20%)
        data
          .filter((d) => d.change !== null && Math.abs(d.change) > 20)
          .map((d) => (
            <ReferenceDot
              key={d.month}
              x={d.month}
              y={d.totalAmount}
              r={8}
              fill={d.change! > 0 ? "#ef4444" : "#22c55e"}
              fillOpacity={0.3}
              stroke={d.change! > 0 ? "#ef4444" : "#22c55e"}
              strokeWidth={2}
            />
          ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
