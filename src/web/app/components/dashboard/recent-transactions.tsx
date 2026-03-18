// Recent transactions — last 5 transactions in a compact table
import { Link } from "react-router";
import { ArrowRight, Receipt } from "lucide-react";
import { useTransactions } from "@/hooks/use-transactions";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { CategoryBadge } from "@/components/shared/category-badge";
import { TransactionDescription } from "@/components/shared/transaction-description";
import { formatDate } from "@/lib/format";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function RecentTransactionsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Receipt className="h-4 w-4" />
          Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentTransactions() {
  const { data, isLoading, isError } = useTransactions({
    limit: 5,
    offset: 0,
  });

  if (isLoading) {
    return <RecentTransactionsSkeleton />;
  }

  if (isError || !data || data.transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Receipt className="h-4 w-4" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No transactions yet. Sync a provider to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Receipt className="h-4 w-4" />
          Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="hidden sm:table-cell">Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(tx.date)}
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <TransactionDescription
                    description={tx.description}
                    descriptionEn={tx.descriptionEn}
                    className="text-sm"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <CurrencyDisplay
                    amount={tx.chargedAmount}
                    currency={tx.chargedCurrency}
                    className="text-sm"
                  />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <CategoryBadge category={tx.category} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <Link
          to="/transactions"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          View All
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
