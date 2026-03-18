// Cashflow card — current month income vs expenses with previous month comparison
import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { useMonthlyReport } from "@/hooks/use-reports";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Get YYYY-MM for the previous month
function getPreviousMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const d = new Date(year, month - 2, 1); // month-2 because Date months are 0-indexed
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Format a month string for display
function monthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short" });
}

function CashflowSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          Cash Flow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-4 w-24" />
      </CardContent>
    </Card>
  );
}

interface BarProps {
  label: string;
  amount: number;
  maxAmount: number;
  color: string;
  icon: React.ReactNode;
}

function CashflowBar({ label, amount, maxAmount, color, icon }: BarProps) {
  const pct = maxAmount > 0 ? Math.min((Math.abs(amount) / maxAmount) * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-medium tabular-nums">
          {formatCurrency(Math.abs(amount))}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CashflowCard() {
  const currentMonth = getCurrentMonth();
  const prevMonth = getPreviousMonth(currentMonth);

  // Fetch current and previous month in one range query
  const { data, isLoading, isError } = useMonthlyReport(prevMonth, currentMonth);

  const { current, previous, percentChange } = useMemo(() => {
    if (!data || data.length === 0) {
      return { current: null, previous: null, percentChange: null };
    }
    const cur = data.find((r) => r.month === currentMonth) || null;
    const prev = data.find((r) => r.month === prevMonth) || null;

    let pctChange: number | null = null;
    if (cur && prev && prev.net !== 0) {
      pctChange = ((cur.net - prev.net) / Math.abs(prev.net)) * 100;
    }

    return { current: cur, previous: prev, percentChange: pctChange };
  }, [data, currentMonth, prevMonth]);

  if (isLoading) {
    return <CashflowSkeleton />;
  }

  if (isError || !current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Cash Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No data for the current month yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalExpenses = current.bankExpenses + current.ccExpenses;
  const maxAmount = Math.max(current.income, totalExpenses, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          Cash Flow
          <span className="ml-auto text-xs">{monthLabel(currentMonth)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CashflowBar
          label="Income"
          amount={current.income}
          maxAmount={maxAmount}
          color="bg-green-500"
          icon={<ArrowDownRight className="h-3.5 w-3.5 text-green-500" />}
        />
        <CashflowBar
          label="Expenses"
          amount={totalExpenses}
          maxAmount={maxAmount}
          color="bg-red-500"
          icon={<ArrowUpRight className="h-3.5 w-3.5 text-red-500" />}
        />

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm font-medium">Net</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-lg font-bold tabular-nums ${
                current.net >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(current.net)}
            </span>
            {percentChange !== null && (
              <span
                className={`flex items-center gap-0.5 text-xs ${
                  percentChange >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {percentChange >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(percentChange).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
        {previous && (
          <p className="text-xs text-muted-foreground">
            vs {monthLabel(prevMonth)}: {formatCurrency(previous.net)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
