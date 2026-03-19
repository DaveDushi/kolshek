// Widget: chart -- Recharts wrapper supporting line, bar, area, pie, donut
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "./widget-registry.js";

// Solid color palette -- no gradients
const CHART_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#14b8a6",
  "#ec4899",
];

// Custom tooltip matching existing project style
function ChartTooltip({ active, payload, label, valueFormat }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      {label && <p className="text-[13px] font-medium">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs text-muted-foreground tabular-nums">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}:{" "}
          {valueFormat === "currency"
            ? formatCurrency(entry.value)
            : typeof entry.value === "number"
              ? entry.value.toLocaleString()
              : entry.value}
        </p>
      ))}
    </div>
  );
}

// Pie/donut tooltip
function PieTooltip({ active, payload, valueFormat }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <p className="text-[13px] font-medium">{item.name}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {valueFormat === "currency"
          ? formatCurrency(item.value)
          : typeof item.value === "number"
            ? item.value.toLocaleString()
            : item.value}
      </p>
    </div>
  );
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
}

export default function WidgetChart({ config, data }: WidgetProps) {
  const title = config.title as string | undefined;
  const chartType = (config.chartType as string) || "line";
  const height = (config.height as number) || 300;
  const dataKey = (config.dataKey as string) || "value";
  const nameKey = (config.nameKey as string) || "name";
  const xAxisKey = (config.xAxisKey as string) || "label";
  const valueFormat = config.valueFormat as string | undefined;
  // Multiple series support for line/bar/area
  const series = config.series as Array<{ dataKey: string; name: string; color?: string }> | undefined;
  // Custom colors override
  const colors = (config.colors as string[]) || CHART_COLORS;

  // Loading state
  if (data === undefined) {
    return <ChartSkeleton height={height} />;
  }

  const chartData = Array.isArray(data) ? data : [];

  if (chartData.length === 0) {
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
          <p className="text-sm text-muted-foreground">No chart data available.</p>
        </CardContent>
      </Card>
    );
  }

  const isPie = chartType === "pie" || chartType === "donut";

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
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {isPie ? (
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey={dataKey}
                  nameKey={nameKey}
                  cx="50%"
                  cy="50%"
                  innerRadius={chartType === "donut" ? "55%" : 0}
                  outerRadius="85%"
                  paddingAngle={chartType === "donut" ? 2 : 1}
                  strokeWidth={0}
                >
                  {chartData.map((_entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={colors[index % colors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip valueFormat={valueFormat} />} />
              </PieChart>
            ) : chartType === "bar" ? (
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/40"
                  vertical={false}
                />
                <XAxis
                  dataKey={xAxisKey}
                  tick={{ fontSize: 12 }}
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={
                    valueFormat === "currency"
                      ? (v: number) => formatCurrency(v)
                      : undefined
                  }
                />
                <Tooltip content={<ChartTooltip valueFormat={valueFormat} />} />
                {series ? (
                  series.map((s, i) => (
                    <Bar
                      key={s.dataKey}
                      dataKey={s.dataKey}
                      name={s.name}
                      fill={s.color || colors[i % colors.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))
                ) : (
                  <Bar
                    dataKey={dataKey}
                    fill={colors[0]}
                    radius={[4, 4, 0, 0]}
                  />
                )}
              </BarChart>
            ) : chartType === "area" ? (
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/40"
                  vertical={false}
                />
                <XAxis
                  dataKey={xAxisKey}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={
                    valueFormat === "currency"
                      ? (v: number) => formatCurrency(v)
                      : undefined
                  }
                />
                <Tooltip content={<ChartTooltip valueFormat={valueFormat} />} />
                {series ? (
                  series.map((s, i) => (
                    <Area
                      key={s.dataKey}
                      type="monotone"
                      dataKey={s.dataKey}
                      name={s.name}
                      stroke={s.color || colors[i % colors.length]}
                      fill={s.color || colors[i % colors.length]}
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  ))
                ) : (
                  <Area
                    type="monotone"
                    dataKey={dataKey}
                    stroke={colors[0]}
                    fill={colors[0]}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                )}
              </AreaChart>
            ) : (
              // Default: line chart
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/40"
                  vertical={false}
                />
                <XAxis
                  dataKey={xAxisKey}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={
                    valueFormat === "currency"
                      ? (v: number) => formatCurrency(v)
                      : undefined
                  }
                />
                <Tooltip content={<ChartTooltip valueFormat={valueFormat} />} />
                {series ? (
                  series.map((s, i) => (
                    <Line
                      key={s.dataKey}
                      type="monotone"
                      dataKey={s.dataKey}
                      name={s.name}
                      stroke={s.color || colors[i % colors.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))
                ) : (
                  <Line
                    type="monotone"
                    dataKey={dataKey}
                    stroke={colors[0]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
