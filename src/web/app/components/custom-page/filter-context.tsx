// Shared page-level filter context for custom dashboard pages.
// The provider wraps the entire page; individual widgets consume filters as needed.
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface FilterState {
  period?: string;
  category?: string[];
  direction?: "expense" | "income" | "all";
}

interface FilterContextValue {
  filters: FilterState;
  setFilters: (next: FilterState | ((prev: FilterState) => FilterState)) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersRaw] = useState<FilterState>({});

  // Accept both a value and a functional updater, same API as useState
  const setFilters = useCallback(
    (next: FilterState | ((prev: FilterState) => FilterState)) => {
      setFiltersRaw(next);
    },
    [],
  );

  return (
    <FilterContext.Provider value={{ filters, setFilters }}>
      {children}
    </FilterContext.Provider>
  );
}

export function usePageFilters(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    throw new Error("usePageFilters must be used within a FilterProvider");
  }
  return ctx;
}
