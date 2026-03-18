// Cashflow card -- current month income vs expenses with previous month comparison
import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
  return d.toLocaleDateString("en-US", { month: "long" });
}

function CashflowSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Minus className="h-3.5 w-3.5" />
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
  barColor: string;
  icon: React.ReactNode;
}

function CashflowBar({ label, amount, maxAmount, barColor, icon }: BarProps) {
  const pct = maxAmount > 0 ? Math.min((Math.abs(amount) / maxAmount) * 100, 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-medium tabular-nums">
          {formatCurrency(Math.abs(amount))}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ease-out ${barColor}`}
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
          <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Minus className="h-3.5 w-3.5" />
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

  const maxAmount = Math.max(current.income, current.expenses, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Minus className="h-3.5 w-3.5" />
          Cash Flow
          <span className="ml-auto text-xs font-normal normal-case tracking-normal">{monthLabel(currentMonth)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Net amount -- hero number */}
        <div className="flex items-baseline gap-3">
          <span
            className={`text-2xl font-bold tabular-nums tracking-display number-tick ${
              current.net >= 0
                ? "text-income"
                : "text-expense"
            }`}
          >
            {formatCurrency(current.net)}
          </span>
          {percentChange !== null && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium ${
                percentChange >= 0
                  ? "bg-income-muted text-income"
                  : "bg-expense-muted text-expense"
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

        {/* Income / Expense bars */}
        <div className="space-y-3">
          <CashflowBar
            label="Income"
            amount={current.income}
            maxAmount={maxAmount}
            barColor="bg-[var(--income)]"
            icon={<ArrowDownLeft className="h-3.5 w-3.5 text-income" />}
          />
          <CashflowBar
            label="Expenses"
            amount={current.expenses}
            maxAmount={maxAmount}
            barColor="bg-[var(--expense)]"
            icon={<ArrowUpRight className="h-3.5 w-3.5 text-expense" />}
          />
        </div>

        {previous && (
          <p className="text-xs text-muted-foreground pt-1">
            vs {monthLabel(prevMonth)}: <span className="tabular-nums font-medium text-foreground/70">{formatCurrency(previous.net)}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
