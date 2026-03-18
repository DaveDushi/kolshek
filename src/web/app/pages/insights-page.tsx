// Insights page — all insights grouped by severity
import { useMemo } from "react";
import { Lightbulb, CalendarClock } from "lucide-react";
import { useInsights } from "@/hooks/use-insights";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { InsightCard } from "@/components/insights/insight-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Insight } from "@/types/api";

// Section header labels and ordering
const SEVERITY_ORDER: Array<{
  key: Insight["severity"];
  label: string;
  description: string;
}> = [
  {
    key: "alert",
    label: "Alerts",
    description: "Significant anomalies that need your attention",
  },
  {
    key: "warning",
    label: "Warnings",
    description: "Notable changes worth reviewing",
  },
  {
    key: "info",
    label: "Info",
    description: "Interesting patterns and observations",
  },
];

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="AI-detected anomalies and spending patterns"
      />
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

interface SeveritySectionProps {
  label: string;
  description: string;
  insights: Insight[];
}

function SeveritySection({ label, description, insights }: SeveritySectionProps) {
  if (insights.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{label}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">
        {insights.map((insight, idx) => (
          <InsightCard key={`${insight.type}-${idx}`} insight={insight} />
        ))}
      </div>
    </section>
  );
}

export function InsightsPage() {
  const { data, isLoading, isError } = useInsights();

  // Group insights by severity
  const grouped = useMemo(() => {
    if (!data) return null;
    const groups: Record<string, Insight[]> = {
      alert: [],
      warning: [],
      info: [],
    };
    for (const insight of data) {
      const bucket = groups[insight.severity];
      if (bucket) {
        bucket.push(insight);
      } else {
        groups.info.push(insight);
      }
    }
    return groups;
  }, [data]);

  if (isLoading) {
    return <InsightsSkeleton />;
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Insights"
          description="AI-detected anomalies and spending patterns"
        />
        <EmptyState
          icon={<Lightbulb />}
          title="Unable to load insights"
          description="Something went wrong while loading your insights. Please try again."
        />
      </div>
    );
  }

  const insights = data || [];

  if (insights.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Insights"
          description="AI-detected anomalies and spending patterns"
        />
        <EmptyState
          icon={<CalendarClock />}
          title="Not enough data yet"
          description="Need at least 2 months of data to generate insights. Keep syncing and check back soon."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="AI-detected anomalies and spending patterns"
      />
      <div className="space-y-8">
        {SEVERITY_ORDER.map((section) => (
          <SeveritySection
            key={section.key}
            label={section.label}
            description={section.description}
            insights={grouped?.[section.key] || []}
          />
        ))}
      </div>
    </div>
  );
}
