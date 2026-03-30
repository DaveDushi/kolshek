// Renders a custom page definition into a tree of widgets.
// Collects all queries from the widget tree, fetches data in one batch,
// then recursively renders each widget with its resolved data.
import { Suspense, useMemo, useCallback } from "react";
import { useWidgetQueries, type BatchQuery } from "@/hooks/use-custom-pages";
import { WIDGET_REGISTRY, type WidgetProps } from "@/components/widgets/widget-registry";
import { FilterProvider, usePageFilters } from "@/components/custom-page/filter-context";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomPageRendererProps {
  pageId: string;
  definition: Record<string, unknown>;
}

// Walk the widget tree and collect all queries with path-based keys
function collectQueries(widget: Record<string, unknown>, prefix: string = "w"): BatchQuery[] {
  const queries: BatchQuery[] = [];
  if (widget.query) {
    queries.push({ key: prefix, query: widget.query as Record<string, unknown> });
  }
  if (Array.isArray(widget.queries)) {
    widget.queries.forEach((q: unknown, i: number) => {
      queries.push({ key: `${prefix}_q${i}`, query: q as Record<string, unknown> });
    });
  }
  // Recurse into children
  if (Array.isArray(widget.children)) {
    widget.children.forEach((child: unknown, i: number) => {
      queries.push(...collectQueries(child as Record<string, unknown>, `${prefix}_${i}`));
    });
  }
  // Recurse into tabs
  if (Array.isArray(widget.tabs)) {
    (widget.tabs as Array<Record<string, unknown>>).forEach((tab, ti) => {
      if (Array.isArray(tab.children)) {
        (tab.children as Array<Record<string, unknown>>).forEach((child, ci) => {
          queries.push(...collectQueries(child, `${prefix}_t${ti}_${ci}`));
        });
      }
    });
  }
  return queries;
}

// Inner component that lives inside FilterProvider so it can read filter context
function RendererInner({ pageId, definition }: CustomPageRendererProps) {
  const { filters, setFilters } = usePageFilters();

  // Collect every query from the full widget tree
  const allQueries = useMemo(() => {
    if (!definition.widget) return [];
    return collectQueries(definition.widget as Record<string, unknown>);
  }, [definition]);

  // Coerce FilterState into the generic record shape the batch hook expects
  const filterRecord = useMemo(
    () => (Object.keys(filters).length > 0 ? (filters as Record<string, unknown>) : undefined),
    [filters],
  );

  const { data: batchResults, isLoading } = useWidgetQueries(pageId, allQueries, filterRecord);

  // Handle filter changes from filter-bar widgets
  const handleFilterChange = useCallback(
    (incoming: Record<string, unknown>) => {
      setFilters((prev) => ({ ...prev, ...incoming }));
    },
    [setFilters],
  );

  // Recursive widget renderer
  const renderWidget = useCallback(
    (widget: Record<string, unknown>, index: number, prefix: string = "w"): React.ReactNode => {
      const widgetType = widget.type as string | undefined;
      if (!widgetType) return null;

      const entry = WIDGET_REGISTRY[widgetType];
      if (!entry) {
        return (
          <p key={`${prefix}_${index}`} className="text-xs text-muted-foreground italic py-2">
            Unknown widget: {widgetType}
          </p>
        );
      }

      const Component = entry.component;
      const currentPrefix = prefix === "w" ? `w_${index}` : `${prefix}_${index}`;

      // Resolve data for this widget from batch results
      let resolvedData: unknown = undefined;
      if (widget.query && batchResults) {
        // Top-level widget uses prefix directly for the first widget, or computed key
        const queryKey = prefix === "w" && index === 0 ? "w" : currentPrefix;
        // Try direct key first, then fall back to the prefix-based key
        resolvedData = (batchResults as Record<string, unknown>)[queryKey]
          ?? (batchResults as Record<string, unknown>)[prefix];
      }
      if (widget.queries && batchResults) {
        // Multiple queries: collect them into an array
        const multiData: unknown[] = [];
        (widget.queries as unknown[]).forEach((_q: unknown, qi: number) => {
          const qKey = `${currentPrefix === "w_0" ? "w" : currentPrefix}_q${qi}`;
          multiData.push((batchResults as Record<string, unknown>)[qKey]);
        });
        resolvedData = multiData;
      }

      // Build props based on widget type
      const baseProps: WidgetProps = {
        config: widget,
        data: resolvedData,
      };

      // Layout widgets get a child render function
      const isLayout = widgetType === "grid" || widgetType === "stack" || widgetType === "tabs";
      const layoutRender = (child: Record<string, unknown>, childIndex: number) =>
        renderWidget(child, childIndex, currentPrefix);

      // Filter bar gets the change handler
      const isFilterBar = widgetType === "filter-bar";

      return (
        <Suspense
          key={`${prefix}_${index}`}
          fallback={<Skeleton className="h-32 w-full rounded-lg" />}
        >
          <Component
            {...baseProps}
            {...(isLayout ? { renderWidget: layoutRender } : {})}
            {...(isFilterBar ? { onFilterChange: handleFilterChange } : {})}
          />
        </Suspense>
      );
    },
    [batchResults, handleFilterChange],
  );

  // Loading skeleton for the full page
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // Render the root widget (or root children array)
  const root = definition.widget as Record<string, unknown> | undefined;
  if (!root) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        This page has no widget definition.
      </p>
    );
  }

  // If the root itself is a single widget, render it directly
  return <>{renderWidget(root, 0)}</>;
}

// Public component: wraps everything in FilterProvider
export function CustomPageRenderer({ pageId, definition }: CustomPageRendererProps) {
  return (
    <FilterProvider>
      <RendererInner pageId={pageId} definition={definition} />
    </FilterProvider>
  );
}
