// Transaction data table with sortable columns, inline category editing,
// and skeleton loading state
import { useState, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { CategoryBadge } from "@/components/shared/category-badge";
import { TransactionDescription } from "@/components/shared/transaction-description";
import { useUpdateCategory } from "@/hooks/use-transactions";
import { useCategoryList } from "@/hooks/use-categories";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TransactionWithContext } from "@/types/api";

interface TransactionTableProps {
  transactions: TransactionWithContext[];
  loading: boolean;
  onRowClick?: (transaction: TransactionWithContext) => void;
}

// Inline category editor shown in a popover when the badge is clicked
function CategoryCell({
  transaction,
}: {
  transaction: TransactionWithContext;
}) {
  const [open, setOpen] = useState(false);
  const { data: categories } = useCategoryList();
  const updateCategory = useUpdateCategory();

  const handleChange = useCallback(
    (value: string) => {
      const category = value === "__none__" ? null : value;
      updateCategory.mutate({ id: transaction.id, category });
      setOpen(false);
    },
    [transaction.id, updateCategory]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`Change category for transaction ${transaction.descriptionEn || transaction.description}`}
        >
          <CategoryBadge category={transaction.category} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Select
          value={transaction.category || "__none__"}
          onValueChange={handleChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Uncategorized</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PopoverContent>
    </Popover>
  );
}

// Status indicator dot
function StatusDot({ status }: { status: "completed" | "pending" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          status === "completed"
            ? "bg-green-500"
            : "bg-amber-500"
        )}
        aria-hidden="true"
      />
      <span className="text-sm capitalize">{status}</span>
    </span>
  );
}

// Installment suffix like "(3/12)"
function installmentSuffix(
  number: number | null,
  total: number | null
): string {
  if (number && total && total > 1) {
    return ` (${number}/${total})`;
  }
  return "";
}

// Skeleton rows shown while loading
function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function TransactionTable({
  transactions,
  loading,
  onRowClick,
}: TransactionTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[90px]">Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right w-[120px]">Amount</TableHead>
          <TableHead className="w-[140px]">Category</TableHead>
          <TableHead className="w-[110px]">Status</TableHead>
          <TableHead className="w-[140px]">Provider</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <SkeletonRows />
        ) : transactions.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={6}
              className="h-24 text-center text-muted-foreground"
            >
              No transactions found
            </TableCell>
          </TableRow>
        ) : (
          transactions.map((tx) => (
            <TableRow
              key={tx.id}
              className={cn(
                onRowClick && "cursor-pointer hover:bg-muted/50"
              )}
              onClick={() => onRowClick?.(tx)}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(tx);
                }
              } : undefined}
            >
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDate(tx.date)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <TransactionDescription
                    description={tx.description}
                    descriptionEn={tx.descriptionEn}
                    className="max-w-[280px]"
                  />
                  {installmentSuffix(
                    tx.installmentNumber,
                    tx.installmentTotal
                  ) && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {installmentSuffix(
                        tx.installmentNumber,
                        tx.installmentTotal
                      )}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell
                className="text-right"
                onClick={(e) => e.stopPropagation()}
              >
                <CurrencyDisplay
                  amount={tx.chargedAmount}
                  currency={tx.chargedCurrency}
                />
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <CategoryCell transaction={tx} />
              </TableCell>
              <TableCell>
                <StatusDot status={tx.status} />
              </TableCell>
              <TableCell className="text-sm">
                {tx.providerDisplayName}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
