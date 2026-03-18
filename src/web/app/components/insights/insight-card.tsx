// Individual insight display card with severity icon, description, and action
import { useNavigate } from "react-router";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { Insight } from "@/types/api";

// Maps severity to icon, colors, and label
const SEVERITY_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    cardBorder: string;
    iconColor: string;
    badgeClass: string;
    label: string;
  }
> = {
  alert: {
    icon: AlertTriangle,
    cardBorder: "border-l-4 border-l-red-500",
    iconColor: "text-red-500",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    label: "Alert",
  },
  warning: {
    icon: AlertCircle,
    cardBorder: "border-l-4 border-l-amber-500",
    iconColor: "text-amber-500",
    badgeClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    label: "Warning",
  },
  info: {
    icon: Info,
    cardBorder: "border-l-4 border-l-blue-500",
    iconColor: "text-blue-500",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    label: "Info",
  },
};

// Determine the navigation target based on the insight type
function getActionRoute(insight: Insight): string | null {
  switch (insight.type) {
    case "category_spike":
      return "/spending";
    case "large_transaction":
    case "new_merchant":
    case "recurring_change":
      return "/transactions";
    case "expense_trend":
    case "negative_cashflow":
      return "/trends";
    default:
      return null;
  }
}

interface InsightCardProps {
  insight: Insight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const navigate = useNavigate();
  const config = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.info;
  const Icon = config.icon;
  const route = getActionRoute(insight);

  return (
    <Card className={config.cardBorder}>
      <CardContent className="flex items-start gap-3 p-4">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.iconColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm leading-tight">
              {insight.title}
            </h3>
            <Badge
              variant="outline"
              className={`shrink-0 border-transparent text-xs ${config.badgeClass}`}
            >
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {insight.detail}
          </p>
          {insight.amount !== undefined && (
            <p className="mt-1 text-sm font-medium tabular-nums">
              {formatCurrency(insight.amount)}
            </p>
          )}
          {route && (
            <Button
              variant="link"
              size="sm"
              className="mt-1 h-auto p-0 text-xs"
              onClick={() => navigate(route)}
            >
              View details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
