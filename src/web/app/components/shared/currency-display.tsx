// Formatted currency display with color coding
// Green for positive (income), default text for negative (expense)
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
}

export function CurrencyDisplay({
  amount,
  currency = "ILS",
  className,
}: CurrencyDisplayProps) {
  const isPositive = amount > 0;
  const formatted = formatCurrency(amount, currency);

  return (
    <span
      className={cn(
        "tabular-nums",
        isPositive && "text-green-600 dark:text-green-400",
        className
      )}
    >
      {formatted}
    </span>
  );
}
