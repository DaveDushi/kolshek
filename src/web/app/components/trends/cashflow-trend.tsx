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
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-1 font-medium">{label ? formatMonth(label + "-01") : ""}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function CashflowTrend({ data }: CashflowTrendProps) {
  // Compute total expenses and format month labels
  const chartData = data.map((d) => ({
    ...d,
    expenses: d.bankExpenses + d.ccExpenses,
    label: formatMonth(d.month + "-01"),
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
        <Legend />
        <Line
          type="monotone"
          dataKey="income"
          name="Income"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          name="Expenses"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="net"
          name="Net"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
