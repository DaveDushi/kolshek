// Income queries — bank income + optional CC refunds.

import { getDatabase } from "../database.js";
import { CC_BILLING_CATEGORY } from "../../types/transaction.js";
import { classifyIncome, type IncomeType } from "../../core/income.js";

export interface IncomeTransaction {
  date: string;
  description: string;
  descriptionEn: string | null;
  chargedAmount: number;
  category: string | null;
  provider: string;
  providerType: string;
  accountNumber: string;
  incomeType: IncomeType;
}

export interface IncomeSummary {
  totalIncome: number;
  salary: number;
  transfers: number;
  refunds: number;
  other: number;
  transactionCount: number;
}

export interface IncomeResult {
  transactions: IncomeTransaction[];
  summary: IncomeSummary;
}

interface IncomeOpts {
  from: string;
  to: string;
  salaryOnly?: boolean;
  includeRefunds?: boolean;
}

export function getIncomeReport(opts: IncomeOpts): IncomeResult {
  const db = getDatabase();
  const params: Record<string, string | number> = {
    $from: opts.from,
    $to: opts.to,
    $ccBilling: CC_BILLING_CATEGORY,
  };

  const conditions = [
    "t.charged_amount > 0",
    "t.date >= $from",
    "t.date <= $to",
    "COALESCE(t.category, '') != $ccBilling",
  ];

  // Default: bank only. With --include-refunds: all providers
  if (!opts.includeRefunds) {
    conditions.push("p.type = 'bank'");
  }

  const sql = `
    SELECT
      t.date, t.description, t.description_en, t.charged_amount, t.category,
      p.alias AS provider, p.type AS provider_type, a.account_number
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY t.charged_amount DESC
  `;

  const rows = db.prepare(sql).all(params) as Array<{
    date: string;
    description: string;
    description_en: string | null;
    charged_amount: number;
    category: string | null;
    provider: string;
    provider_type: string;
    account_number: string;
  }>;

  let transactions: IncomeTransaction[] = rows.map((r) => ({
    date: r.date,
    description: r.description,
    descriptionEn: r.description_en,
    chargedAmount: r.charged_amount,
    category: r.category,
    provider: r.provider,
    providerType: r.provider_type,
    accountNumber: r.account_number,
    incomeType: classifyIncome(r.description, r.category, r.provider_type),
  }));

  if (opts.salaryOnly) {
    transactions = transactions.filter((t) => t.incomeType === "salary");
  }

  const summary: IncomeSummary = {
    totalIncome: 0,
    salary: 0,
    transfers: 0,
    refunds: 0,
    other: 0,
    transactionCount: transactions.length,
  };

  for (const t of transactions) {
    summary.totalIncome += t.chargedAmount;
    switch (t.incomeType) {
      case "salary": summary.salary += t.chargedAmount; break;
      case "transfer": summary.transfers += t.chargedAmount; break;
      case "refund": summary.refunds += t.chargedAmount; break;
      default: summary.other += t.chargedAmount;
    }
  }

  return { transactions, summary };
}
