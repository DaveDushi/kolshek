// Net worth card -- total balance across all accounts with per-account breakdown
import { useNavigate } from "react-router";
import { Wallet, Eye, EyeOff } from "lucide-react";
import { useBalanceReport, useToggleAccountExclusion } from "@/hooks/use-accounts";
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
  const toggleExclusion = useToggleAccountExclusion();

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

  // Only sum active (non-excluded) accounts
  const totalBalance = accounts
    .filter((row) => !row.excluded)
    .reduce((sum, row) => sum + (row.balance ?? 0), 0);

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
            <div
              key={`${account.accountNumber}-${account.provider}`}
              className={`flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-150 ${account.excluded ? "opacity-40" : ""}`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExclusion.mutate({
                    accountId: account.accountId,
                    excluded: !account.excluded,
                  });
                }}
                className="shrink-0 p-0.5 rounded hover:bg-muted/80 text-muted-foreground transition-colors"
                title={account.excluded ? "Include in syncing" : "Exclude from syncing"}
              >
                {account.excluded ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/transactions?provider=${encodeURIComponent(account.provider)}`
                  )
                }
                className="flex flex-1 items-center justify-between min-w-0 hover:bg-muted/60 rounded-md px-1 py-0.5 transition-colors"
              >
                <span className="truncate text-muted-foreground">
                  {displayName(account)}
                  {account.excluded && (
                    <span className="ml-1.5 text-[11px] text-muted-foreground/60">
                      Excluded
                    </span>
                  )}
                </span>
                <CurrencyDisplay
                  amount={account.balance ?? 0}
                  currency={account.currency}
                  className={`font-medium text-[13px] shrink-0 ml-3 ${account.excluded ? "line-through" : ""}`}
                />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
