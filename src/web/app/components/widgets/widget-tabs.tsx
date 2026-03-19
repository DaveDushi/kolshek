// Widget: tabs -- tab container that renders child widgets in each tab
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LayoutWidgetProps } from "./widget-registry.js";

// Each tab definition from config
interface TabDef {
  label: string;
  value: string;
  children: Record<string, unknown>[];
}

function TabsSkeleton() {
  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}

export default function WidgetTabs({ config, renderWidget }: LayoutWidgetProps) {
  const tabs = (config.tabs as TabDef[]) || [];
  const defaultTab = config.defaultTab as string | undefined;

  // Loading state
  if (tabs.length === 0) {
    return <TabsSkeleton />;
  }

  const initialValue = defaultTab || tabs[0]?.value || "tab-0";

  return (
    <Card>
      <CardContent className="pt-5">
        <Tabs defaultValue={initialValue}>
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <div className="flex flex-col gap-4">
                {(tab.children || []).map((child, index) =>
                  renderWidget(child, index),
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
