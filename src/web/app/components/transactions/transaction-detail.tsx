// Transaction detail sheet — slides out from the right showing full
// transaction information with editable category
import { useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { CategoryBadge } from "@/components/shared/category-badge";
import { useUpdateCategory } from "@/hooks/use-transactions";
import { useCategoryList } from "@/hooks/use-categories";
import { formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TransactionWithContext } from "@/types/api";

interface TransactionDetailProps {
  transaction: TransactionWithContext | null;
  open: boolean;
  onClose: () => void;
}

// Simple heuristic: if the string contains Hebrew Unicode range characters
function isHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

// Single labeled field row
function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function TransactionDetail({
  transaction,
  open,
  onClose,
}: TransactionDetailProps) {
  const { data: categories } = useCategoryList();
  const updateCategory = useUpdateCategory();

  const handleCategoryChange = useCallback(
    (value: string) => {
      if (!transaction) return;
      const category = value === "__none__" ? null : value;
      updateCategory.mutate({ id: transaction.id, category });
    },
    [transaction, updateCategory]
  );

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Transaction Details</SheetTitle>
          <SheetDescription>
            {transaction
              ? transaction.descriptionEn || transaction.description
              : "No transaction selected"}
          </SheetDescription>
        </SheetHeader>

        {transaction && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 pb-6">
              {/* Amount section */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Charged Amount
                  </p>
                  <CurrencyDisplay
                    amount={transaction.chargedAmount}
                    currency={transaction.chargedCurrency}
                    className="text-2xl font-bold"
                  />
                </div>
                <Badge
                  variant={
                    transaction.status === "completed"
                      ? "default"
                      : "secondary"
                  }
                  className={cn(
                    transaction.status === "completed"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
                    "border-transparent"
                  )}
                >
                  {transaction.status}
                </Badge>
              </div>

              <Separator />

              {/* Description */}
              <div className="space-y-3">
                {transaction.descriptionEn && (
                  <DetailRow label="English Name">
                    {transaction.descriptionEn}
                  </DetailRow>
                )}

                <DetailRow label="Original Description (Hebrew)">
                  <span
                    dir={isHebrew(transaction.description) ? "rtl" : undefined}
                    className="block"
                  >
                    {transaction.description}
                  </span>
                </DetailRow>

                {transaction.memo && (
                  <DetailRow label="Memo">
                    <span
                      dir={isHebrew(transaction.memo) ? "rtl" : undefined}
                      className="block"
                    >
                      {transaction.memo}
                    </span>
                  </DetailRow>
                )}
              </div>

              <Separator />

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Transaction Date">
                  {formatFullDate(transaction.date)}
                </DetailRow>
                <DetailRow label="Processed Date">
                  {formatFullDate(transaction.processedDate)}
                </DetailRow>
              </div>

              <Separator />

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Original Amount">
                  <CurrencyDisplay
                    amount={transaction.originalAmount}
                    currency={transaction.originalCurrency}
                  />
                </DetailRow>
                <DetailRow label="Charged Amount">
                  <CurrencyDisplay
                    amount={transaction.chargedAmount}
                    currency={transaction.chargedCurrency}
                  />
                </DetailRow>
              </div>

              {/* Installment info */}
              {transaction.installmentTotal &&
                transaction.installmentTotal > 1 && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <DetailRow label="Installment">
                        {transaction.installmentNumber} of{" "}
                        {transaction.installmentTotal}
                      </DetailRow>
                      <DetailRow label="Type">
                        <Badge variant="outline" className="capitalize">
                          {transaction.type}
                        </Badge>
                      </DetailRow>
                    </div>
                  </>
                )}

              <Separator />

              {/* Provider & Account */}
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Provider">
                  {transaction.providerDisplayName}
                </DetailRow>
                <DetailRow label="Account">
                  {transaction.accountNumber}
                </DetailRow>
              </div>

              <Separator />

              {/* Category (editable) */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Category
                </Label>
                <div className="flex items-center gap-3">
                  <CategoryBadge category={transaction.category} />
                  <Select
                    value={transaction.category || "__none__"}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Change category" />
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
                </div>
              </div>

              <Separator />

              {/* Technical IDs */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Internal
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="Transaction ID">
                    <code className="text-xs">{transaction.id}</code>
                  </DetailRow>
                  <DetailRow label="Account ID">
                    <code className="text-xs">{transaction.accountId}</code>
                  </DetailRow>
                  <DetailRow label="Company ID">
                    <code className="text-xs">{transaction.providerCompanyId}</code>
                  </DetailRow>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
