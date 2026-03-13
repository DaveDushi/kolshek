// Pure insight detection logic — no DB or CLI imports.

export type InsightSeverity = "info" | "warning" | "alert";

export interface Insight {
  type: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  amount?: number;
}

interface MonthlyCategory {
  month: string;
  category: string;
  total: number;
}

interface MerchantHistory {
  merchant: string;
  monthsSeen: number;
  currentAmount: number;
  avgAmount: number;
  firstSeen: string;
}

interface MonthCashflow {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

interface LargeTransaction {
  description: string;
  amount: number;
  date: string;
}

// Detect categories with spending spikes (>50% above 3mo avg)
export function detectCategorySpikes(
  currentMonth: MonthlyCategory[],
  priorMonths: MonthlyCategory[],
): Insight[] {
  const insights: Insight[] = [];

  const priorAvg = new Map<string, number>();
  const priorCounts = new Map<string, number>();
  for (const m of priorMonths) {
    priorAvg.set(m.category, (priorAvg.get(m.category) ?? 0) + m.total);
    priorCounts.set(m.category, (priorCounts.get(m.category) ?? 0) + 1);
  }
  for (const [cat, total] of priorAvg) {
    priorAvg.set(cat, total / (priorCounts.get(cat) ?? 1));
  }

  for (const cur of currentMonth) {
    const avg = priorAvg.get(cur.category);
    if (avg && avg > 0 && cur.total > avg * 1.5) {
      const pctOver = Math.round(((cur.total - avg) / avg) * 100);
      insights.push({
        type: "category_spike",
        severity: pctOver >= 100 ? "alert" : "warning",
        title: `${cur.category} spending up ${pctOver}%`,
        detail: `This month: ${cur.total.toFixed(2)} vs avg ${avg.toFixed(2)}`,
        amount: cur.total - avg,
      });
    }
  }

  return insights;
}

// Detect unusually large individual transactions
export function detectLargeTransactions(
  transactions: LargeTransaction[],
  avgTransactionSize: number,
): Insight[] {
  const threshold = avgTransactionSize * 2;
  return transactions
    .filter((t) => t.amount > threshold)
    .slice(0, 5)
    .map((t) => ({
      type: "large_transaction",
      severity: "info" as InsightSeverity,
      title: `Large charge: ${t.description}`,
      detail: `${t.amount.toFixed(2)} on ${t.date} (avg txn: ${avgTransactionSize.toFixed(2)})`,
      amount: t.amount,
    }));
}

// Detect first-time merchants with significant spend
export function detectNewMerchants(merchants: MerchantHistory[]): Insight[] {
  return merchants
    .filter((m) => m.monthsSeen === 1)
    .sort((a, b) => b.currentAmount - a.currentAmount)
    .slice(0, 5)
    .map((m) => ({
      type: "new_merchant",
      severity: "info" as InsightSeverity,
      title: `New: ${m.merchant}`,
      detail: `First purchase: ${m.currentAmount.toFixed(2)}`,
      amount: m.currentAmount,
    }));
}

// Detect recurring merchants with amount changes (>20%)
export function detectRecurringChanges(merchants: MerchantHistory[]): Insight[] {
  return merchants
    .filter((m) => m.monthsSeen >= 3 && m.avgAmount > 0)
    .filter((m) => Math.abs(m.currentAmount - m.avgAmount) / m.avgAmount > 0.2)
    .sort((a, b) => Math.abs(b.currentAmount - b.avgAmount) - Math.abs(a.currentAmount - a.avgAmount))
    .slice(0, 5)
    .map((m) => {
      const pct = Math.round(((m.currentAmount - m.avgAmount) / m.avgAmount) * 100);
      const dir = pct > 0 ? "up" : "down";
      return {
        type: "recurring_change",
        severity: (Math.abs(pct) >= 50 ? "warning" : "info") as InsightSeverity,
        title: `${m.merchant} ${dir} ${Math.abs(pct)}%`,
        detail: `This month: ${m.currentAmount.toFixed(2)} vs avg ${m.avgAmount.toFixed(2)}`,
        amount: m.currentAmount - m.avgAmount,
      };
    });
}

// Detect cashflow trend warnings
export function detectTrendWarnings(months: MonthCashflow[]): Insight[] {
  const insights: Insight[] = [];
  const chrono = [...months].reverse();

  // 3+ months consecutive expense increase
  let consecIncreases = 0;
  for (let i = 1; i < chrono.length; i++) {
    if (chrono[i].expenses > chrono[i - 1].expenses) {
      consecIncreases++;
    } else {
      consecIncreases = 0;
    }
  }
  if (consecIncreases >= 2) {
    insights.push({
      type: "expense_trend",
      severity: "warning",
      title: `Expenses rising for ${consecIncreases + 1} months`,
      detail: "Consider reviewing spending patterns",
    });
  }

  // 2+ months negative cashflow
  let negativeMonths = 0;
  for (const m of chrono.slice(-3)) {
    if (m.net < 0) negativeMonths++;
  }
  if (negativeMonths >= 2) {
    insights.push({
      type: "negative_cashflow",
      severity: "alert",
      title: `Negative cashflow for ${negativeMonths} of last 3 months`,
      detail: "Spending exceeds income — review budget",
    });
  }

  return insights;
}
