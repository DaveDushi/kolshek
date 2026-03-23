// Transactions page — filter panel, data table, pagination, and detail sheet
import { useState, useCallback, useRef } from "react";
import { Download, Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterPanel } from "@/components/transactions/filter-panel";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { TransactionDetail } from "@/components/transactions/transaction-detail";
import { RuleBuilder } from "@/components/categories/rule-builder";
import { useTransactions } from "@/hooks/use-transactions";
import type { TransactionFilters, TransactionWithContext } from "@/types/api";

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

// Generate page numbers with ellipsis for compact pagination
function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) pages.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("ellipsis");

  pages.push(total);
  return pages;
}

export function TransactionsPage() {
  useDocumentTitle("Transactions");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState<TransactionFilters>({
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
  });
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Detail sheet state
  const [selectedTx, setSelectedTx] = useState<TransactionWithContext | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);

  // Rule builder state
  const [ruleBuilderOpen, setRuleBuilderOpen] = useState(false);
  const [rulePrefill, setRulePrefill] = useState<{ description?: string }>({});

  // Fetch transactions with current filters
  const { data, isLoading, isError, error } = useTransactions(filters);

  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;

  // Pagination helpers
  const currentPage = Math.floor((filters.offset || 0) / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const goToPage = useCallback(
    (page: number) => {
      setFilters((prev) => ({
        ...prev,
        offset: (page - 1) * pageSize,
      }));
      tableContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [pageSize]
  );

  const handlePageSizeChange = useCallback(
    (newSize: string) => {
      const size = Number(newSize);
      setPageSize(size);
      setFilters((prev) => ({
        ...prev,
        limit: size,
        offset: 0,
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

  // Export as CSV
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

  const showPagination = total > 0;
  const pageNumbers = getPageNumbers(currentPage, totalPages);
  const rangeStart = (filters.offset || 0) + 1;
  const rangeEnd = Math.min((filters.offset || 0) + pageSize, total);

  return (
    <div className="space-y-4">
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
          containerRef={tableContainerRef}
        />
      )}

      {/* Pagination */}
      {showPagination && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t pt-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              {rangeStart.toLocaleString()}-{rangeEnd.toLocaleString()} of{" "}
              {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Rows</span>
              <Select
                value={String(pageSize)}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="h-8 w-[68px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {pageNumbers.map((page, idx) =>
              page === "ellipsis" ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-sm text-muted-foreground select-none"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8 text-xs"
                  onClick={() => goToPage(page)}
                  aria-label={`Page ${page}`}
                  aria-current={page === currentPage ? "page" : undefined}
                >
                  {page}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail sheet */}
      <TransactionDetail
        transaction={selectedTx}
        open={detailOpen}
        onClose={handleDetailClose}
        onCreateRule={(prefill) => {
          setRulePrefill(prefill);
          setRuleBuilderOpen(true);
        }}
      />

      {/* Rule builder dialog */}
      <RuleBuilder
        open={ruleBuilderOpen}
        onClose={() => setRuleBuilderOpen(false)}
        prefill={rulePrefill}
      />
    </div>
  );
}
