// Spending analysis page with chart, table, and filters
import { useState } from "react";
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useSpending } from "@/hooks/use-spending";
import { getCurrentMonth, formatMonth } from "@/lib/format";
import { SPENDING_DEFAULT_EXCLUDES } from "@/lib/classification";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { ClassificationFilter } from "@/components/shared/classification-filter";
import { SpendingChart } from "@/components/spending/spending-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

// Shift month string by delta months: "2024-03" + (-1) -> "2024-02"
function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type GroupBy = "category" | "merchant" | "provider";

export function SpendingPage() {
  useDocumentTitle("Spending");
  const [month, setMonth] = useState(getCurrentMonth);
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [excluded, setExcluded] = useState<string[]>([...SPENDING_DEFAULT_EXCLUDES]);

  const { data: items, isLoading } = useSpending(month, groupBy, undefined, excluded);

  const totalAmount = items?.reduce((sum, i) => sum + i.amount, 0) ?? 0;
  const totalCount = items?.reduce((sum, i) => sum + i.count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Spending" description="Analyze where your money goes" />

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Month picker */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Month</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-medium">
              {formatMonth(month + "-01")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Group by */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Group by</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="merchant">Merchant</SelectItem>
              <SelectItem value="provider">Provider</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      {/* Classification filter */}
      <ClassificationFilter
        excluded={excluded}
        onChange={setExcluded}
        defaults={SPENDING_DEFAULT_EXCLUDES}
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <CurrencyDisplay amount={-totalAmount} className="text-2xl font-bold" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">{totalCount}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-[300px] w-full" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!items || items.length === 0) && (
        <EmptyState
          icon={<ShoppingCart />}
          title="No spending data"
          description={`No spending data found for ${formatMonth(month + "-01")}. Try a different month.`}
        />
      )}

      {/* Chart + Table */}
      {!isLoading && items && items.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <SpendingChart items={items} />
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">
                        <CurrencyDisplay amount={-item.amount} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.percentage.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
