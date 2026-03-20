// Balance reconciliation form + result display
import { useState } from "react";
import { useBalanceCheck } from "@/hooks/use-reconciliation";
import { useBalanceReport } from "@/hooks/use-accounts";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BalanceReconciliationApi } from "@/types/api";

export function BalanceCheck() {
  const { data: accounts } = useBalanceReport();
  const balanceCheck = useBalanceCheck();

  const [accountId, setAccountId] = useState("");
  const [expectedBalance, setExpectedBalance] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const result = balanceCheck.data;

  const handleCheck = () => {
    if (!accountId || !expectedBalance) return;
    balanceCheck.mutate({
      accountId: Number(accountId),
      expectedBalance: Number(expectedBalance),
      from: from || undefined,
      to: to || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Check Account Balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {(accounts ?? []).map((acc) => (
                    <SelectItem key={acc.accountNumber} value={String(acc.accountNumber)}>
                      {acc.providerAlias} &middot; {acc.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Expected Balance</Label>
              <Input
                type="number"
                placeholder="e.g. 12500"
                value={expectedBalance}
                onChange={(e) => setExpectedBalance(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">From (optional)</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">To (optional)</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleCheck}
            disabled={!accountId || !expectedBalance || balanceCheck.isPending}
          >
            {balanceCheck.isPending ? "Checking..." : "Check Balance"}
          </Button>
        </CardContent>
      </Card>

      {result && <BalanceResult result={result} />}

      {balanceCheck.isError && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-destructive">
              {balanceCheck.error?.message ?? "Balance check failed"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BalanceResult({ result }: { result: BalanceReconciliationApi }) {
  const matches = Math.abs(result.discrepancy) < 0.01;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {result.providerAlias} &middot; {result.accountNumber}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[13px]">
          <div>
            <p className="text-muted-foreground text-xs">Expected</p>
            <p className="font-medium tabular-nums">
              {formatCurrency(result.expectedBalance, result.currency)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Computed</p>
            <p className="font-medium tabular-nums">
              {formatCurrency(result.computedBalance, result.currency)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Discrepancy</p>
            <p
              className={cn(
                "font-semibold tabular-nums",
                matches
                  ? "text-green-600 dark:text-green-400"
                  : "text-destructive"
              )}
            >
              {matches ? "None" : formatCurrency(result.discrepancy, result.currency)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Transactions</p>
            <p className="font-medium tabular-nums">{result.transactionCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Date Range</p>
            <p className="font-medium text-xs">
              {result.dateRange.from} &mdash; {result.dateRange.to}
            </p>
          </div>
        </div>

        {!matches && (
          <p className="mt-4 text-xs text-muted-foreground">
            {result.discrepancy > 0
              ? "The computed balance is higher than expected. You may have missing expenses or extra income recorded."
              : "The computed balance is lower than expected. You may have missing income or extra expenses recorded."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
