// Colored badge for category names
// Uses a deterministic color derived from the category name hash
// "Uncategorized" / null always renders as muted gray
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  category: string | null;
  className?: string;
}

// Predefined color palette for category badges
// Each entry is [bg, text] for light mode and dark mode
const COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200",
];

const UNCATEGORIZED_STYLE =
  "bg-muted text-muted-foreground border-transparent";

// Simple string hash to pick a consistent color index
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const isUncategorized = !category || category === "Uncategorized";
  const label = isUncategorized ? "Uncategorized" : category;

  const colorClass = isUncategorized
    ? UNCATEGORIZED_STYLE
    : COLORS[hashString(category) % COLORS.length];

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-medium",
        colorClass,
        className
      )}
    >
      {label}
    </Badge>
  );
}
