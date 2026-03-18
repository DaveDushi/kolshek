// Line chart for total cashflow trends (income, expenses, net)
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatCurrency, formatMonth } from "@/lib/format";
import type { TrendTotal } from "@/types/api";

interface CashflowTrendProps {
  data: TrendTotal[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
      <p className="mb-1.5 text-[13px] font-medium">{label ? formatMonth(label + "-01") : ""}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs tabular-nums" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function CashflowTrend({ data }: CashflowTrendProps) {
  // Format month labels
  const chartData = data.map((d) => ({
    ...d,
    label: formatMonth(d.month + "-01"),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
        <XAxis
          dataKey="month"
          tickFormatter={(v: string) => {
            const d = new Date(v + "-01");
            return d.toLocaleDateString("en-US", { month: "short" });
          }}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrency(v)}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
        />
        <Line
          type="monotone"
          dataKey="income"
          name="Income"
          stroke="var(--income)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--income)" }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          name="Expenses"
          stroke="var(--expense)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--expense)" }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="net"
          name="Net"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={{ r: 3, fill: "var(--primary)" }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
