// Dashboard page — assembles all dashboard cards in a responsive grid
import { useNavigate } from "react-router";
import { LayoutDashboard } from "lucide-react";
import { useBalanceReport } from "@/hooks/use-accounts";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { CashflowCard } from "@/components/dashboard/cashflow-card";
import { SpendingDonut } from "@/components/dashboard/spending-donut";
import { InsightsCard } from "@/components/dashboard/insights-card";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: balanceData, isLoading } = useBalanceReport();

  // balanceData is a BalanceRow[] array (not { accounts })
  const accounts = Array.isArray(balanceData) ? balanceData : [];
  const hasNoData = !isLoading && accounts.length === 0;

  if (hasNoData) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={<LayoutDashboard />}
          title="No accounts found"
          description="Connect a bank or credit card provider to see your financial dashboard."
          action={{
            label: "Add Provider",
            onClick: () => navigate("/providers"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />

      {/* 2x2 grid on desktop, single column on mobile */}
      <div className="grid gap-4 md:grid-cols-2">
        <NetWorthCard />
        <CashflowCard />
        <SpendingDonut />
        <InsightsCard />
      </div>

      {/* Recent transactions spans full width */}
      <RecentTransactions />
    </div>
  );
}
