// Transactions page — filter panel, data table, pagination, and detail sheet
import { useState, useCallback } from "react";
import { Download, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterPanel } from "@/components/transactions/filter-panel";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { TransactionDetail } from "@/components/transactions/transaction-detail";
import { useTransactions } from "@/hooks/use-transactions";
import type { TransactionFilters, TransactionWithContext } from "@/types/api";

const PAGE_SIZE = 50;

export function TransactionsPage() {
  // Filters include pagination via limit/offset
  const [filters, setFilters] = useState<TransactionFilters>({
    limit: PAGE_SIZE,
    offset: 0,
  });

  // Detail sheet state
  const [selectedTx, setSelectedTx] = useState<TransactionWithContext | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch transactions with current filters
  const { data, isLoading, isError, error } = useTransactions(filters);

  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;

  // Pagination helpers
  const currentPage = Math.floor((filters.offset || 0) / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = useCallback(
    (page: number) => {
      setFilters((prev) => ({
        ...prev,
        offset: (page - 1) * PAGE_SIZE,
      }));
    },
    []
  );

  const handleRowClick = useCallback((tx: TransactionWithContext) => {
    setSelectedTx(tx);
    setDetailOpen(true);
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false);
  }, []);

  // Export as CSV (simple client-side implementation)
  const exportCsv = useCallback(() => {
    if (!transactions.length) return;

    const headers = [
      "Date",
      "Description",
      "Description (English)",
      "Amount",
      "Currency",
      "Category",
      "Status",
      "Provider",
      "Account",
    ];
    const rows = transactions.map((tx) => [
      tx.date,
      `"${tx.description.replace(/"/g, '""')}"`,
      `"${(tx.descriptionEn || "").replace(/"/g, '""')}"`,
      String(tx.chargedAmount),
      tx.chargedCurrency,
      tx.category || "Uncategorized",
      tx.status,
      tx.providerDisplayName,
      tx.accountNumber,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [transactions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description={
          total > 0 ? `${total.toLocaleString()} transactions` : undefined
        }
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportCsv}>
              Export as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      <FilterPanel filters={filters} onChange={setFilters} />

      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load transactions:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {!isLoading && !isError && transactions.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="No transactions found"
          description="Try adjusting your filters or sync your bank accounts to import transactions."
        />
      ) : (
        <TransactionTable
          transactions={transactions}
          loading={isLoading}
          onRowClick={handleRowClick}
        />
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {((filters.offset || 0) + 1).toLocaleString()}-
            {Math.min(
              (filters.offset || 0) + PAGE_SIZE,
              total
            ).toLocaleString()}{" "}
            of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail sheet */}
      <TransactionDetail
        transaction={selectedTx}
        open={detailOpen}
        onClose={handleDetailClose}
      />
    </div>
  );
}
