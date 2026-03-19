// Widget registry -- maps widget type strings to lazy-loaded React components
import { lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";

// Base props shared by all widget components.
// `data` holds the resolved query result; `config` holds the JSON page definition.
// Layout widgets (grid, stack, tabs) also receive a `renderWidget` function.
export interface WidgetProps {
  config: Record<string, unknown>;
  data?: unknown;
  onFilterChange?: (filters: Record<string, unknown>) => void;
}

// Layout widgets receive a render function for recursive child rendering
export interface LayoutWidgetProps extends WidgetProps {
  renderWidget: (widget: Record<string, unknown>, index: number) => ReactNode;
}

type WidgetEntry = {
  component: LazyExoticComponent<ComponentType<any>>;
  label: string;
};

// Central registry mapping type strings to their lazy-loaded components
export const WIDGET_REGISTRY: Record<string, WidgetEntry> = {
  "metric-card": {
    component: lazy(() => import("./widget-metric-card.js")),
    label: "Metric Card",
  },
  chart: {
    component: lazy(() => import("./widget-chart.js")),
    label: "Chart",
  },
  table: {
    component: lazy(() => import("./widget-table.js")),
    label: "Data Table",
  },
  "progress-bar": {
    component: lazy(() => import("./widget-progress-bar.js")),
    label: "Progress Bar",
  },
  comparison: {
    component: lazy(() => import("./widget-comparison.js")),
    label: "Comparison",
  },
  alert: {
    component: lazy(() => import("./widget-alert.js")),
    label: "Alert",
  },
  text: {
    component: lazy(() => import("./widget-text.js")),
    label: "Text Block",
  },
  grid: {
    component: lazy(() => import("./widget-grid.js")),
    label: "Grid Layout",
  },
  stack: {
    component: lazy(() => import("./widget-stack.js")),
    label: "Stack Layout",
  },
  tabs: {
    component: lazy(() => import("./widget-tabs.js")),
    label: "Tabs",
  },
  "filter-bar": {
    component: lazy(() => import("./widget-filter-bar.js")),
    label: "Filter Bar",
  },
};
