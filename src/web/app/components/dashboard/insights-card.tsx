// Insights card — top 3 insights with severity indicators
import { Link } from "react-router";
import { Lightbulb, CheckCircle2, ArrowRight } from "lucide-react";
import { useInsights } from "@/hooks/use-insights";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Border and badge styles keyed by severity
const SEVERITY_STYLES: Record<
  string,
  { border: string; badge: string; label: string }
> = {
  alert: {
    border: "border-l-red-500",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    label: "Alert",
  },
  warning: {
    border: "border-l-amber-500",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    label: "Warning",
  },
  info: {
    border: "border-l-blue-500",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    label: "Info",
  },
};

function InsightsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
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

  // No insights — all clear
  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
            <p className="font-medium">All clear</p>
            <p className="text-sm text-muted-foreground">
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
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          Insights
          <Badge variant="secondary" className="ml-auto">
            {insights.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {topInsights.map((insight, idx) => {
          const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;
          return (
            <div
              key={`${insight.type}-${idx}`}
              className={`rounded-md border-l-4 bg-muted/50 px-3 py-2 ${style.border}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-tight">
                  {insight.title}
                </p>
                <Badge
                  variant="outline"
                  className={`shrink-0 border-transparent text-xs ${style.badge}`}
                >
                  {style.label}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {insight.detail}
              </p>
            </div>
          );
        })}
      </CardContent>
      <CardFooter>
        <Link
          to="/insights"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          View All
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
