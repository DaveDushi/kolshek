// Widget: text -- simple text block with size variants
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "./widget-registry.js";

// Size variant classes
const SIZE_CLASSES: Record<string, string> = {
  sm: "text-sm text-muted-foreground",
  base: "text-base text-foreground",
  lg: "text-lg font-medium text-foreground",
  xl: "text-xl font-semibold text-foreground",
};

function TextSkeleton() {
  return (
    <Card>
      <CardContent className="pt-5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-2 h-5 w-1/2" />
      </CardContent>
    </Card>
  );
}

export default function WidgetText({ config, data }: WidgetProps) {
  // Content can come from config (static) or data (dynamic)
  const staticContent = config.content as string | undefined;
  const size = (config.size as string) || "base";
  const wrapped = config.card !== false; // Default: wrapped in Card

  // Loading state -- only when we expect dynamic data
  if (data === undefined && !staticContent) {
    return <TextSkeleton />;
  }

  const content = staticContent || (typeof data === "string" ? data : "");

  if (!content) {
    return null;
  }

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.base;

  // Split on newlines to render paragraphs
  const paragraphs = content.split("\n").filter(Boolean);

  const textBlock = (
    <div className={cn("space-y-2", sizeClass)}>
      {paragraphs.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );

  if (!wrapped) {
    return textBlock;
  }

  return (
    <Card>
      <CardContent className="pt-5">
        {textBlock}
      </CardContent>
    </Card>
  );
}
