// Net worth card -- total balance across all accounts with per-account breakdown
import { useNavigate } from "react-router";
import { Wallet } from "lucide-react";
import { useBalanceReport } from "@/hooks/use-accounts";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function NetWorthSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          Net Worth
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-8 w-36" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}

export function NetWorthCard() {
  const { data, isLoading, isError } = useBalanceReport();
  const navigate = useNavigate();

  if (isLoading) {
    return <NetWorthSkeleton />;
  }

  const accounts = Array.isArray(data) ? data : [];

  if (isError || accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            Net Worth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load balance data.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalBalance = accounts.reduce(
    (sum, row) => sum + (row.balance ?? 0),
    0
  );

  // Display name: use alias if set, otherwise provider name + account
  const displayName = (row: (typeof accounts)[0]) =>
    row.providerAlias || `${row.provider} ${row.accountNumber}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          Net Worth
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CurrencyDisplay
          amount={totalBalance}
          className="text-2xl font-bold tracking-display number-tick"
        />
        <div className="space-y-1">
          {accounts.map((account) => (
            <button
              key={`${account.accountNumber}-${account.provider}`}
              type="button"
              onClick={() =>
                navigate(
                  `/transactions?provider=${encodeURIComponent(account.provider)}`
                )
              }
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] transition-colors duration-150 hover:bg-muted/60"
            >
              <span className="truncate text-muted-foreground">
                {displayName(account)}
              </span>
              <CurrencyDisplay
                amount={account.balance ?? 0}
                currency={account.currency}
                className="font-medium text-[13px] shrink-0 ml-3"
              />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
