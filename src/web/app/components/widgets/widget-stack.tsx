// Widget: stack -- flexbox layout with vertical or horizontal direction
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { LayoutWidgetProps } from "./widget-registry.js";

export default function WidgetStack({ config, renderWidget }: LayoutWidgetProps) {
  const children = (config.children as Record<string, unknown>[]) || [];
  const direction = (config.direction as string) || "vertical";
  const gap = (config.gap as number) || 4;

  // Loading state -- no children defined
  if (children.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const isHorizontal = direction === "horizontal";

  return (
    <div
      className={cn(
        "flex",
        isHorizontal ? "flex-row flex-wrap items-start" : "flex-col",
      )}
      style={{ gap: `${gap * 0.25}rem` }}
    >
      {children.map((child, index) => (
        <div
          key={index}
          className={cn(isHorizontal ? "flex-1 min-w-0" : "w-full")}
        >
          {renderWidget(child, index)}
        </div>
      ))}
    </div>
  );
}
