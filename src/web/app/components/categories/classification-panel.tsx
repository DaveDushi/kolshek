// Classification management for the active category
import { useClassificationMap, useSetClassification } from "@/hooks/use-categories";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BuiltinClassification } from "@/types/api";

const BUILTIN: { value: BuiltinClassification; label: string; color: string }[] = [
  { value: "expense", label: "Expense", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "income", label: "Income", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { value: "cc_billing", label: "CC Billing", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  { value: "transfer", label: "Transfer", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "investment", label: "Investment", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "debt", label: "Debt", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "savings", label: "Savings", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
];

export function classificationColor(classification: string): string {
  return BUILTIN.find((b) => b.value === classification)?.color
    ?? "bg-muted text-muted-foreground";
}

export function classificationLabel(classification: string): string {
  return BUILTIN.find((b) => b.value === classification)?.label ?? classification;
}

interface ClassificationPanelProps {
  category: string;
}

export function ClassificationPanel({ category }: ClassificationPanelProps) {
  const { data: classMap } = useClassificationMap();
  const setClassification = useSetClassification();

  const current = classMap?.[category] ?? "expense";

  function handleChange(value: string) {
    if (value === current) return;
    setClassification.mutate({ name: category, classification: value });
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-muted-foreground shrink-0">Classification</span>
      <Select value={current} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-[160px] text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BUILTIN.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              <span className="flex items-center gap-2">
                <span className={cn("inline-block h-2 w-2 rounded-full", item.color.split(" ")[0])} />
                {item.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {setClassification.isPending && (
        <span className="text-xs text-muted-foreground">Saving...</span>
      )}
    </div>
  );
}

// Small badge to show classification in the sidebar
export function ClassificationBadge({ classification }: { classification: string }) {
  const colors = classificationColor(classification);
  const label = classificationLabel(classification);
  return (
    <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-4 font-normal", colors)}>
      {label}
    </Badge>
  );
}
