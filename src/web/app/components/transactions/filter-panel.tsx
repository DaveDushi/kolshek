// Collapsible filter panel for transactions
// Provides date range, provider, category, status, amount, and search filters
import { useState, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Search,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useProviders } from "@/hooks/use-providers";
import { useCategoryList } from "@/hooks/use-categories";
import { cn } from "@/lib/utils";
import type { TransactionFilters } from "@/types/api";

interface FilterPanelProps {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
}

// Describes one active filter chip for display
interface ActiveFilter {
  key: keyof TransactionFilters;
  label: string;
  value: string;
}

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: providers } = useProviders();
  const { data: categories } = useCategoryList();

  // Build active filter chips from current filter state
  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const chips: ActiveFilter[] = [];

    if (filters.from) {
      chips.push({ key: "from", label: "From", value: filters.from });
    }
    if (filters.to) {
      chips.push({ key: "to", label: "To", value: filters.to });
    }
    if (filters.provider) {
      const match = providers?.find(
        (p) => String(p.id) === filters.provider
      );
      chips.push({
        key: "provider",
        label: "Provider",
        value: match?.displayName || filters.provider,
      });
    }
    if (filters.category) {
      chips.push({
        key: "category",
        label: "Category",
        value: filters.category,
      });
    }
    if (filters.status) {
      chips.push({
        key: "status",
        label: "Status",
        value: filters.status === "completed" ? "Completed" : "Pending",
      });
    }
    if (filters.minAmount !== undefined) {
      chips.push({
        key: "minAmount",
        label: "Min",
        value: String(filters.minAmount),
      });
    }
    if (filters.maxAmount !== undefined) {
      chips.push({
        key: "maxAmount",
        label: "Max",
        value: String(filters.maxAmount),
      });
    }
    if (filters.search) {
      chips.push({
        key: "search",
        label: "Search",
        value: filters.search,
      });
    }

    return chips;
  }, [filters, providers]);

  const hasActiveFilters = activeFilters.length > 0;

  // Remove a single filter
  const removeFilter = useCallback(
    (key: keyof TransactionFilters) => {
      const next = { ...filters };
      delete next[key];
      onChange(next);
    },
    [filters, onChange]
  );

  // Clear all filters (keep limit/offset)
  const clearAll = useCallback(() => {
    onChange({ limit: filters.limit, offset: 0 });
  }, [filters.limit, onChange]);

  // Update a single filter field, resetting offset to 0
  const setFilter = useCallback(
    (key: keyof TransactionFilters, value: string | number | undefined) => {
      const next: TransactionFilters = { ...filters, offset: 0 };
      if (value === undefined || value === "" || value === null) {
        delete next[key];
      } else {
        // Coerce to the correct type for the target key
        (next as Record<string, unknown>)[key] = value;
      }
      onChange(next);
    },
    [filters, onChange]
  );

  return (
    <div className="space-y-3">
      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((chip) => (
            <Badge
              key={chip.key}
              variant="secondary"
              className="gap-1 pr-1"
            >
              <span className="text-muted-foreground">{chip.label}:</span>
              {chip.value}
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                onClick={() => removeFilter(chip.key)}
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-6 px-2 text-xs text-muted-foreground"
          >
            Clear All
          </Button>
        </div>
      )}

      {/* Search bar + toggle button (always visible) */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search transactions..."
            value={filters.search || ""}
            onChange={(e) => setFilter("search", e.target.value || undefined)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
          className={cn("gap-1.5", hasActiveFilters && "border-primary")}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Collapsible filter fields */}
      {expanded && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Date From */}
          <div className="space-y-1.5">
            <Label htmlFor="filter-from">From</Label>
            <Input
              id="filter-from"
              type="date"
              value={filters.from || ""}
              onChange={(e) =>
                setFilter("from", e.target.value || undefined)
              }
            />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <Label htmlFor="filter-to">To</Label>
            <Input
              id="filter-to"
              type="date"
              value={filters.to || ""}
              onChange={(e) =>
                setFilter("to", e.target.value || undefined)
              }
            />
          </div>

          {/* Provider */}
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select
              value={filters.provider || "__all__"}
              onValueChange={(val) =>
                setFilter("provider", val === "__all__" ? undefined : val)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All providers</SelectItem>
                {providers?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={filters.category || "__all__"}
              onValueChange={(val) =>
                setFilter("category", val === "__all__" ? undefined : val)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={filters.status || "__all__"}
              onValueChange={(val) =>
                setFilter("status", val === "__all__" ? undefined : val)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount Range */}
          <div className="space-y-1.5">
            <Label>Amount Range</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.minAmount ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilter(
                    "minAmount",
                    val === "" ? undefined : Number(val)
                  );
                }}
                className="w-full"
              />
              <span className="text-muted-foreground text-sm">-</span>
              <Input
                type="number"
                placeholder="Max"
                value={filters.maxAmount ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilter(
                    "maxAmount",
                    val === "" ? undefined : Number(val)
                  );
                }}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
