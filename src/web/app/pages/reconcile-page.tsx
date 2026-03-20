// Reconciliation page — duplicates, balance check, history
import { useState } from "react";
import { GitCompareArrows } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  useDuplicateCandidates,
  useReconcileDecision,
  useReconcileHistory,
} from "@/hooks/use-reconciliation";
import { formatFullDate, formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DuplicatePairCard } from "@/components/reconciliation/duplicate-pair-card";
import { BalanceCheck } from "@/components/reconciliation/balance-check";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function ReconcilePage() {
  useDocumentTitle("Reconcile");

  return (
    <div className="space-y-5">
      <PageHeader title="Reconcile" description="Find duplicates and verify account balances" />

      <Tabs defaultValue="duplicates">
        <TabsList>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          <TabsTrigger value="balance">Balance Check</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="duplicates">
          <DuplicatesTab />
        </TabsContent>

        <TabsContent value="balance">
          <BalanceCheck />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// -- Duplicates Tab --

function DuplicatesTab() {
  const [filters] = useState<Record<string, unknown>>({});
  const { data, isLoading } = useDuplicateCandidates(filters);
  const decide = useReconcileDecision();

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const candidates = data?.candidates ?? [];

  if (candidates.length === 0) {
    return (
      <EmptyState
        icon={<GitCompareArrows />}
        title="No duplicates found"
        description="No potential duplicate transactions were detected."
      />
    );
  }

  return (
    <div className="space-y-3 mt-1">
      <p className="text-xs text-muted-foreground">
        {candidates.length} potential duplicate{candidates.length !== 1 ? "s" : ""} found
      </p>
      {candidates.map((c, i) => (
        <DuplicatePairCard
          key={`${c.txA.id}-${c.txB.id}`}
          candidate={c}
          isLoading={decide.isPending}
          onKeepLeft={() =>
            decide.mutate({
              txIdA: c.txA.id,
              txIdB: c.txB.id,
              decision: "merged",
              keepTxId: c.txA.id,
            })
          }
          onKeepRight={() =>
            decide.mutate({
              txIdA: c.txA.id,
              txIdB: c.txB.id,
              decision: "merged",
              keepTxId: c.txB.id,
            })
          }
          onDismiss={() =>
            decide.mutate({
              txIdA: c.txA.id,
              txIdB: c.txB.id,
              decision: "dismissed",
            })
          }
        />
      ))}
    </div>
  );
}

// -- History Tab --

function HistoryTab() {
  const [filters] = useState<Record<string, unknown>>({});
  const { data, isLoading } = useReconcileHistory(filters);

  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardContent className="pt-6">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<GitCompareArrows />}
        title="No history"
        description="No reconciliation decisions have been recorded yet."
      />
    );
  }

  return (
    <Card className="mt-1">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Past Decisions ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Transaction Pair</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="text-[13px] tabular-nums">{record.id}</TableCell>
                  <TableCell className="text-[13px] tabular-nums">
                    #{record.txIdA} &harr; #{record.txIdB}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={record.decision === "merged" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {record.decision}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[13px] tabular-nums">
                    {(record.score * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {formatFullDate(record.decidedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
