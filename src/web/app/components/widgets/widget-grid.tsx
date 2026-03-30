// Widget: grid -- CSS grid layout container with responsive columns
import { useId } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LayoutWidgetProps } from "./widget-registry.js";

// Gap size in rem (Tailwind gap-N = N*0.25rem)
function gapToRem(gap: number): string {
  return `${gap * 0.25}rem`;
}

export default function WidgetGrid({ config, renderWidget }: LayoutWidgetProps) {
  const children = (config.children as Record<string, unknown>[]) || [];
  const colsSm = (config.colsSm as number) || 1;
  const colsMd = (config.colsMd as number) || 2;
  const colsLg = (config.colsLg as number) || 3;
  const gap = (config.gap as number) || 4;

  // Unique id for scoped responsive styles
  const rawId = useId();
  // CSS selectors cannot contain colons, so strip them
  const gridId = `wg-${rawId.replace(/:/g, "")}`;

  // Loading state -- no children defined
  if (children.length === 0) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // Scoped responsive CSS for this specific grid instance.
  // We use inline <style> with a unique data attribute to avoid
  // dynamic Tailwind class names that would be purged at build time.
  const responsiveCss = [
    `[data-grid-id="${gridId}"] { display: grid; gap: ${gapToRem(gap)}; grid-template-columns: repeat(${colsSm}, minmax(0, 1fr)); }`,
    `@media (min-width: 768px) { [data-grid-id="${gridId}"] { grid-template-columns: repeat(${colsMd}, minmax(0, 1fr)); } }`,
    `@media (min-width: 1024px) { [data-grid-id="${gridId}"] { grid-template-columns: repeat(${colsLg}, minmax(0, 1fr)); } }`,
  ].join("\n");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: responsiveCss }} />
      <div data-grid-id={gridId}>
        {children.map((child, index) => renderWidget(child, index))}
      </div>
    </>
  );
}
