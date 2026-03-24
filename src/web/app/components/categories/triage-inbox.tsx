// Transaction panel for re-categorizing transactions within a category
import { useState, useCallback } from "react";
import { useCategoryTransactions, useCategoryList } from "@/hooks/use-categories";
import { useUpdateCategory } from "@/hooks/use-transactions";
import { formatDate } from "@/lib/format";
import { TransactionDescription } from "@/components/shared/transaction-description";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Inbox } from "lucide-react";

interface TriageInboxProps {
  category: string;
}

export function TriageInbox({ category }: TriageInboxProps) {
  const { data: transactions, isLoading } = useCategoryTransactions(category);
  const { data: categoryList } = useCategoryList();
  const updateCategory = useUpdateCategory();

  // Batch mode state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchCategory, setBatchCategory] = useState("");

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (!transactions) return;
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((t) => t.id)));
    }
  }, [transactions, selected.size]);

  function handleMove(id: number, newCategory: string) {
    updateCategory.mutate({ id, category: newCategory });
  }

  function handleBatchMove() {
    if (!batchCategory || selected.size === 0) return;
    for (const id of selected) {
      updateCategory.mutate({ id, category: batchCategory });
    }
    setSelected(new Set());
    setBatchCategory("");
  }

  // Available categories minus the current one
  const otherCategories = (categoryList ?? []).filter((c) => c !== category);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="No transactions"
        description={`No transactions found in "${category}".`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{category}</h3>
        <span className="text-sm text-muted-foreground">
          {transactions.length} transactions
        </span>
      </div>

      {/* Batch controls */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted p-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select value={batchCategory} onValueChange={setBatchCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Move to..." />
            </SelectTrigger>
            <SelectContent>
              {otherCategories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!batchCategory || updateCategory.isPending}
            onClick={handleBatchMove}
          >
            Move
          </Button>
        </div>
      )}

      <ScrollArea className="max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={
                    transactions.length > 0 && selected.size === transactions.length
                  }
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-input"
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Move to</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(tx.id)}
                    onChange={() => toggleSelect(tx.id)}
                    className="h-4 w-4 rounded border-input"
                    aria-label={`Select transaction ${tx.id}`}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(tx.date)}
                </TableCell>
                <TableCell>
                  <TransactionDescription
                    description={tx.description}
                    descriptionEn={tx.descriptionEn}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <CurrencyDisplay amount={tx.chargedAmount} />
                </TableCell>
                <TableCell>
                  <Select
                    value=""
                    onValueChange={(val) => handleMove(tx.id, val)}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Move to..." />
                    </SelectTrigger>
                    <SelectContent>
                      {otherCategories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
