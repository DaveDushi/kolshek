// Net worth card — total balance across all accounts with per-account breakdown
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
import { Separator } from "@/components/ui/separator";

function NetWorthSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Wallet className="h-4 w-4" />
          Net Worth
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Separator />
        <div className="space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
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
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Wallet className="h-4 w-4" />
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
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Wallet className="h-4 w-4" />
          Net Worth
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CurrencyDisplay
          amount={totalBalance}
          className="text-3xl font-bold"
        />
        <Separator />
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li key={`${account.accountNumber}-${account.provider}`}>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/transactions?provider=${encodeURIComponent(account.provider)}`
                  )
                }
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="truncate font-medium">
                  {displayName(account)}
                </span>
                <CurrencyDisplay
                  amount={account.balance ?? 0}
                  currency={account.currency}
                  className="font-medium"
                />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
