// Reusable classification filter — toggle chips to include/exclude classifications
import { useClassificationMap } from "@/hooks/use-categories";
import { cn } from "@/lib/utils";
import {
  BUILTIN,
  classificationColor,
  classificationDot,
  classificationLabel,
} from "@/lib/classification";
import { RotateCcw } from "lucide-react";

interface ClassificationFilterProps {
  // Which classifications are currently excluded
  excluded: string[];
  // Callback when exclusion set changes
  onChange: (excluded: string[]) => void;
  // Default exclusion list for this page (used by Reset)
  defaults: string[];
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = a.toSorted();
  const sortedB = b.toSorted();
  return sortedA.every((v, i) => v === sortedB[i]);
}

export function ClassificationFilter({ excluded, onChange, defaults }: ClassificationFilterProps) {
  const { data: classMap } = useClassificationMap();

  // Discover custom classifications from the map
  const builtinValues = new Set(BUILTIN.map((b) => b.value));
  const customValues = classMap
    ? [...new Set(Object.values(classMap))].filter((v) => !builtinValues.has(v)).toSorted()
    : [];

  const excludedSet = new Set(excluded);
  const isDefault = arraysEqual(excluded, defaults);

  function toggle(value: string) {
    if (excludedSet.has(value)) {
      onChange(excluded.filter((v) => v !== value));
    } else {
      onChange([...excluded, value]);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Classifications</span>
        {!isDefault && (
          <button
            onClick={() => onChange([...defaults])}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BUILTIN.map((item) => {
          const isExcluded = excludedSet.has(item.value);
          return (
            <button
              key={item.value}
              onClick={() => toggle(item.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-all cursor-pointer",
                isExcluded
                  ? "opacity-40 border-border/40 bg-muted/50 text-muted-foreground line-through"
                  : cn("border-transparent", classificationColor(item.value)),
              )}
              title={isExcluded ? `Show ${item.label}` : `Hide ${item.label}`}
            >
              <span className={cn(
                "inline-block h-2 w-2 rounded-full shrink-0",
                isExcluded ? "bg-muted-foreground/40" : classificationDot(item.value),
              )} />
              {item.label}
            </button>
          );
        })}
        {customValues.map((value) => {
          const isExcluded = excludedSet.has(value);
          const label = classificationLabel(value);
          return (
            <button
              key={value}
              onClick={() => toggle(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-all cursor-pointer",
                isExcluded
                  ? "opacity-40 border-border/40 bg-muted/50 text-muted-foreground line-through"
                  : cn("border-transparent", classificationColor(value)),
              )}
              title={isExcluded ? `Show ${label}` : `Hide ${label}`}
            >
              <span className={cn(
                "inline-block h-2 w-2 rounded-full shrink-0",
                isExcluded ? "bg-muted-foreground/40" : classificationDot(value),
              )} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
