// Widget: filter-bar -- date range, category, and direction filters
import { useCallback, useState, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { getCurrentMonth } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "./widget-registry.js";

// Direction options for the toggle
const DIRECTION_OPTIONS = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
];

function FilterSkeleton() {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function WidgetFilterBar({ config, data, onFilterChange }: WidgetProps) {
  // Categories can come from config (static) or data (dynamic)
  const staticCategories = config.categories as string[] | undefined;
  const categories = staticCategories || (Array.isArray(data) ? data : []);
  const showDateRange = config.showDateRange !== false;
  const showCategory = config.showCategory !== false;
  const showDirection = config.showDirection !== false;

  // Default values
  const currentMonth = getCurrentMonth();
  const [fromMonth, setFromMonth] = useState(
    (config.defaultFrom as string) || currentMonth,
  );
  const [toMonth, setToMonth] = useState(
    (config.defaultTo as string) || currentMonth,
  );
  const [category, setCategory] = useState<string>(
    (config.defaultCategory as string) || "all",
  );
  const [direction, setDirection] = useState<string>(
    (config.defaultDirection as string) || "all",
  );

  const emitChange = useCallback(
    (overrides: Record<string, unknown>) => {
      if (!onFilterChange) return;
      const filters = {
        fromMonth,
        toMonth,
        category,
        direction,
        ...overrides,
      };
      onFilterChange(filters);
    },
    [onFilterChange, fromMonth, toMonth, category, direction],
  );

  const handleFromChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setFromMonth(val);
      emitChange({ fromMonth: val });
    },
    [emitChange],
  );

  const handleToChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setToMonth(val);
      emitChange({ toMonth: val });
    },
    [emitChange],
  );

  const handleCategoryChange = useCallback(
    (val: string) => {
      setCategory(val);
      emitChange({ category: val });
    },
    [emitChange],
  );

  const handleDirectionChange = useCallback(
    (val: string) => {
      setDirection(val);
      emitChange({ direction: val });
    },
    [emitChange],
  );

  // Show skeleton only when expecting dynamic categories and none arrived
  if (data === undefined && !staticCategories && showCategory) {
    return <FilterSkeleton />;
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-end gap-4">
          {/* Date range */}
          {showDateRange && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="month"
                  value={fromMonth}
                  onChange={handleFromChange}
                  className="w-36"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="month"
                  value={toMonth}
                  onChange={handleToChange}
                  className="w-36"
                />
              </div>
            </>
          )}

          {/* Category dropdown */}
          {showCategory && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {(categories as string[]).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Direction toggle */}
          {showDirection && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <div className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted/50 p-1">
                {DIRECTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleDirectionChange(opt.value)}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium transition-all duration-150",
                      direction === opt.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
