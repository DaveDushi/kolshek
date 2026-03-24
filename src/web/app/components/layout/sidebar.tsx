// Desktop sidebar navigation for the KolShek dashboard
import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Lightbulb,
  ArrowLeftRight,
  PieChart,
  TrendingUp,
  Tags,
  Languages,
  Building2,
  Bot,
  Clock,
  Sun,
  Moon,
  Monitor,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import { useSync } from "@/hooks/use-sync";
import { useInsights } from "@/hooks/use-insights";
import { useCategorySummary } from "@/hooks/use-categories";
import { useUntranslated } from "@/hooks/use-translations";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SyncPanel } from "./sync-panel";

// Navigation item definition
interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: () => React.ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Hook to compute badge data for nav items
function useNavBadges() {
  const { data: insights } = useInsights();
  const { data: categories } = useCategorySummary();
  const { data: untranslated } = useUntranslated();

  const alertCount = insights?.filter((i) => i.severity === "alert").length ?? 0;

  // Count uncategorized transactions
  const uncategorizedCount =
    categories?.find((c) => c.category === "" || c.category === "uncategorized")
      ?.count ?? 0;

  const untranslatedCount = untranslated?.length ?? 0;

  return { alertCount, uncategorizedCount, untranslatedCount };
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { events, isRunning, start, cancel } = useSync();
  const { alertCount, uncategorizedCount, untranslatedCount } = useNavBadges();
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);

  // Build navigation groups with live badge data
  const navGroups: NavGroup[] = [
    {
      title: "Overview",
      items: [
        {
          label: "Dashboard",
          path: "/",
          icon: LayoutDashboard,
        },
        {
          label: "Insights",
          path: "/insights",
          icon: Lightbulb,
          badge: () =>
            alertCount > 0 ? (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                {alertCount}
              </Badge>
            ) : null,
        },
      ],
    },
    {
      title: "Money",
      items: [
        { label: "Transactions", path: "/transactions", icon: ArrowLeftRight },
        { label: "Spending", path: "/spending", icon: PieChart },
        { label: "Trends", path: "/trends", icon: TrendingUp },
      ],
    },
    {
      title: "Organize",
      items: [
        {
          label: "Categories",
          path: "/categories",
          icon: Tags,
          badge: () =>
            uncategorizedCount > 0 ? (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            ) : null,
        },
        {
          label: "Translations",
          path: "/translations",
          icon: Languages,
          badge: () =>
            untranslatedCount > 0 ? (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                {untranslatedCount}
              </Badge>
            ) : null,
        },
      ],
    },
    {
      title: "AI",
      items: [
        { label: "Agent", path: "/agent", icon: Bot },
      ],
    },
    {
      title: "Settings",
      items: [
        { label: "Providers", path: "/providers", icon: Building2 },
        { label: "Schedule", path: "/schedule", icon: Clock },
      ],
    },
  ];

  const isActive = useCallback(
    (path: string) => {
      if (path === "/") return location.pathname === "/";
      return location.pathname.startsWith(path);
    },
    [location.pathname]
  );

  // Find the last sync time from the most recent result event
  const lastSyncedAt = events
    .filter((e) => e.type === "result" || e.type === "done")
    .length > 0
    ? new Date().toISOString()
    : null;

  const handleSync = useCallback(() => {
    if (isRunning) {
      setSyncPanelOpen(true);
      return;
    }
    start();
    setSyncPanelOpen(true);
  }, [isRunning, start]);

  const themeIcon =
    theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const ThemeIcon = themeIcon;

  return (
    <>
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-sidebar-border bg-sidebar z-30">
        {/* Logo / brand */}
        <div className="flex h-14 items-center px-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <img src="/logo.png" alt="KolShek" className="h-10 w-10 rounded-md" />
          </button>
        </div>

        {/* Scrollable nav area */}
        <ScrollArea className="flex-1 py-1">
          <nav className="space-y-0.5 px-3" aria-label="Main navigation">
            {navGroups.map((group, groupIdx) => (
              <div key={group.title} className={cn(groupIdx > 0 && "mt-6")}>
                <p className="px-2 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    const badgeEl = item.badge?.() ?? null;
                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={cn(
                          "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-150",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                          active
                            ? "bg-primary-subtle text-primary"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors duration-150",
                            active
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                          )}
                        />
                        <span className="flex-1 text-left">{item.label}</span>
                        {badgeEl}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Bottom controls */}
        <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
          {/* Sync status / button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-[13px] h-8"
                onClick={handleSync}
                disabled={false}
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5",
                    isRunning && "animate-spin"
                  )}
                />
                <span className="flex-1 text-left text-xs text-muted-foreground">
                  {isRunning
                    ? "Syncing..."
                    : lastSyncedAt
                      ? `Synced ${formatRelativeTime(lastSyncedAt)}`
                      : "Sync now"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isRunning ? "View sync progress" : "Fetch latest transactions"}
            </TooltipContent>
          </Tooltip>

          {/* Sync progress mini-section when running */}
          <div className="px-2" aria-live="polite" role="status">
            {isRunning && events.length > 0 && (
              <p className="text-[11px] text-muted-foreground truncate">
                {events[events.length - 1]?.provider
                  ? `${events[events.length - 1].provider}: ${events[events.length - 1].stage || "working..."}`
                  : events[events.length - 1]?.message || "working..."}
              </p>
            )}
          </div>

          {/* Theme toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-[13px] h-8"
              >
                <ThemeIcon className="h-3.5 w-3.5" />
                <span className="text-xs text-muted-foreground capitalize">{theme}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="h-4 w-4 mr-2" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="h-4 w-4 mr-2" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <SyncPanel
        open={syncPanelOpen}
        onOpenChange={setSyncPanelOpen}
        events={events}
        isRunning={isRunning}
        onRetry={() => start()}
        onCancel={cancel}
      />
    </>
  );
}
