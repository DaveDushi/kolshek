// Insights card -- top 3 insights with severity indicators
import { Link } from "react-router";
import { Lightbulb, CheckCircle2, ArrowRight } from "lucide-react";
import { useInsights } from "@/hooks/use-insights";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Severity-keyed visual styles using semantic tokens
const SEVERITY_STYLES: Record<
  string,
  { dot: string; bg: string; label: string }
> = {
  alert: {
    dot: "bg-red-500",
    bg: "bg-expense-muted",
    label: "Alert",
  },
  warning: {
    dot: "bg-amber-500",
    bg: "bg-amber-500/5 dark:bg-amber-500/10",
    label: "Warning",
  },
  info: {
    dot: "bg-blue-500",
    bg: "bg-blue-500/5 dark:bg-blue-500/10",
    label: "Info",
  },
};

function InsightsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5" />
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </CardContent>
    </Card>
  );
}

export function InsightsCard() {
  const { data, isLoading, isError } = useInsights();

  if (isLoading) {
    return <InsightsSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  const insights = data || [];
  const topInsights = insights.slice(0, 3);

  // No insights -- all clear
  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-income mb-2" />
            <p className="text-sm font-medium">All clear</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No anomalies detected
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5" />
          Insights
          <span className="ml-auto text-xs font-normal normal-case tracking-normal text-muted-foreground">
            {insights.length} total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {topInsights.map((insight, idx) => {
          const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;
          return (
            <div
              key={`${insight.type}-${idx}`}
              className={`rounded-lg px-3 py-2.5 ${style.bg}`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-tight">
                    {insight.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {insight.detail}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
      {insights.length > 3 && (
        <CardFooter>
          <Link
            to="/insights"
            className="group flex items-center gap-1 text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            View all {insights.length} insights
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}
