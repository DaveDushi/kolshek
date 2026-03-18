// Trends analysis page with Cashflow, Category, and Fixed vs Variable tabs
import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  useTotalTrends,
  useCategoryTrend,
  useFixedVariable,
} from "@/hooks/use-trends";
import { useCategoryList } from "@/hooks/use-categories";
import { formatMonth } from "@/lib/format";
import { REPORT_DEFAULT_EXCLUDES } from "@/lib/classification";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { ClassificationFilter } from "@/components/shared/classification-filter";
import { CashflowTrend } from "@/components/trends/cashflow-trend";
import { CategoryTrend as CategoryTrendChart } from "@/components/trends/category-trend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";

type Period = "3" | "6" | "12";

export function TrendsPage() {
  useDocumentTitle("Trends");
  const [months, setMonths] = useState<Period>("6");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [excluded, setExcluded] = useState<string[]>([...REPORT_DEFAULT_EXCLUDES]);

  const monthsNum = Number(months);

  return (
    <div className="space-y-5">
      <PageHeader title="Trends" description="Track your financial trends over time">
        {/* Period selector */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Period</Label>
          <Select value={months} onValueChange={(v) => setMonths(v as Period)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 months</SelectItem>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      {/* Classification filter */}
      <ClassificationFilter
        excluded={excluded}
        onChange={setExcluded}
        defaults={REPORT_DEFAULT_EXCLUDES}
      />

      <Tabs defaultValue="cashflow">
        <TabsList>
          <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
          <TabsTrigger value="category">Category</TabsTrigger>
          <TabsTrigger value="fixed-variable">Fixed vs Variable</TabsTrigger>
        </TabsList>

        <TabsContent value="cashflow">
          <CashflowTab months={monthsNum} exclude={excluded} />
        </TabsContent>

        <TabsContent value="category">
          <CategoryTab
            months={monthsNum}
            exclude={excluded}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </TabsContent>

        <TabsContent value="fixed-variable">
          <FixedVariableTab months={monthsNum} exclude={excluded} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// -- Cashflow Tab --

function CashflowTab({ months, exclude }: { months: number; exclude: string[] }) {
  const { data, isLoading } = useTotalTrends(months, exclude);

  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardContent className="pt-6">
          <Skeleton className="h-[320px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp />}
        title="No trend data"
        description="Not enough transaction history to show trends."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Income vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowTrend data={data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Expense Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-medium text-[13px]">
                    {formatMonth(row.month + "-01")}
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay amount={row.income} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay amount={-row.expenses} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay amount={row.net} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.expenseChange !== null ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                          row.expenseChange > 0
                            ? "bg-expense-muted text-expense"
                            : "bg-income-muted text-income"
                        )}
                      >
                        {row.expenseChange > 0 ? "+" : ""}
                        {row.expenseChange.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// -- Category Tab --

function CategoryTab({
  months,
  exclude,
  selectedCategory,
  onCategoryChange,
}: {
  months: number;
  exclude: string[];
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
}) {
  const { data: categories } = useCategoryList();
  const { data: trend, isLoading } = useCategoryTrend(selectedCategory, months, exclude);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Category</Label>
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {(categories ?? []).map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedCategory && (
        <EmptyState
          icon={<TrendingUp />}
          title="Select a category"
          description="Choose a category above to see its spending trend."
        />
      )}

      {selectedCategory && isLoading && (
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      )}

      {selectedCategory && !isLoading && trend && trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{selectedCategory} Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryTrendChart data={trend} />
          </CardContent>
        </Card>
      )}

      {selectedCategory && !isLoading && (!trend || trend.length === 0) && (
        <EmptyState
          icon={<TrendingUp />}
          title="No data"
          description={`No trend data found for "${selectedCategory}".`}
        />
      )}
    </div>
  );
}

// -- Fixed vs Variable Tab --

function FixedVariableTab({ months, exclude }: { months: number; exclude: string[] }) {
  const { data, isLoading } = useFixedVariable(months, exclude);

  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardContent className="pt-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp />}
        title="No data"
        description="Not enough recurring transactions to classify fixed vs variable expenses."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Fixed vs Variable Expenses by Month</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Fixed</TableHead>
              <TableHead className="text-right">Variable</TableHead>
              <TableHead className="text-right">Fixed %</TableHead>
              <TableHead className="text-right">Fixed Merchants</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.month}>
                <TableCell className="font-medium text-[13px]">
                  {formatMonth(item.month + "-01")}
                </TableCell>
                <TableCell className="text-right">
                  <CurrencyDisplay amount={-item.fixed} />
                </TableCell>
                <TableCell className="text-right">
                  <CurrencyDisplay amount={-item.variable} />
                </TableCell>
                <TableCell className="text-right tabular-nums text-[13px]">
                  {item.fixedPercent.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right tabular-nums text-[13px]">
                  {item.fixedMerchants}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
