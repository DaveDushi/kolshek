// Transaction description display
// Shows English name if available, otherwise Hebrew with RTL direction
import { cn } from "@/lib/utils";

interface TransactionDescriptionProps {
  description: string;
  descriptionEn: string | null;
  className?: string;
}

// Simple heuristic: if the string contains Hebrew Unicode range characters
function isHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

export function TransactionDescription({
  description,
  descriptionEn,
  className,
}: TransactionDescriptionProps) {
  // Prefer English translation when available
  if (descriptionEn) {
    return (
      <span className={cn("truncate", className)}>{descriptionEn}</span>
    );
  }

  // Fall back to original description, marking RTL for Hebrew text
  const hebrew = isHebrew(description);
  return (
    <span
      className={cn("truncate", className)}
      dir={hebrew ? "rtl" : undefined}
    >
      {description}
    </span>
  );
}
