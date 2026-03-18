// Mobile bottom tab bar with "More" sheet for full navigation
import { useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Tags,
  Menu,
  Lightbulb,
  TrendingUp,
  Languages,
  Building2,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/hooks/use-theme";
import { useSync } from "@/hooks/use-sync";
import { useInsights } from "@/hooks/use-insights";
import { useCategorySummary } from "@/hooks/use-categories";
import { useUntranslated } from "@/hooks/use-translations";
import { cn } from "@/lib/utils";
import { SyncPanel } from "./sync-panel";

// Bottom tab items — the 5 visible tabs
interface TabItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Transactions", path: "/transactions", icon: ArrowLeftRight },
  { label: "Spending", path: "/spending", icon: PieChart },
  { label: "Categories", path: "/categories", icon: Tags },
];

// Full nav items for the "More" sheet
interface MoreNavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
}

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { events, isRunning, start } = useSync();
  const { data: insights } = useInsights();
  const { data: categories } = useCategorySummary();
  const { data: untranslated } = useUntranslated();

  const [moreOpen, setMoreOpen] = useState(false);
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);

  const alertCount = insights?.filter((i) => i.severity === "alert").length ?? 0;
  const uncategorizedCount =
    categories?.find((c) => c.category === "" || c.category === "uncategorized")
      ?.count ?? 0;
  const untranslatedCount = untranslated?.length ?? 0;

  const isActive = useCallback(
    (path: string) => {
      if (path === "/") return location.pathname === "/";
      return location.pathname.startsWith(path);
    },
    [location.pathname]
  );

  // Check if current page is one NOT in the bottom tabs (meaning "More" should be highlighted)
  const isMoreActive =
    !TABS.some((tab) => isActive(tab.path)) &&
    location.pathname !== "/";

  const moreNavItems: MoreNavItem[] = [
    {
      label: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
    },
    {
      label: "Insights",
      path: "/insights",
      icon: Lightbulb,
      badge:
        alertCount > 0 ? (
          <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
            {alertCount}
          </Badge>
        ) : null,
    },
    {
      label: "Transactions",
      path: "/transactions",
      icon: ArrowLeftRight,
    },
    {
      label: "Spending",
      path: "/spending",
      icon: PieChart,
    },
    {
      label: "Trends",
      path: "/trends",
      icon: TrendingUp,
    },
    {
      label: "Categories",
      path: "/categories",
      icon: Tags,
      badge:
        uncategorizedCount > 0 ? (
          <span className="h-2 w-2 rounded-full bg-amber-500" />
        ) : null,
    },
    {
      label: "Translations",
      path: "/translations",
      icon: Languages,
      badge:
        untranslatedCount > 0 ? (
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
            {untranslatedCount}
          </Badge>
        ) : null,
    },
    {
      label: "Providers",
      path: "/providers",
      icon: Building2,
    },
  ];

  const handleMoreNav = useCallback(
    (path: string) => {
      navigate(path);
      setMoreOpen(false);
    },
    [navigate]
  );

  const handleSync = useCallback(() => {
    if (!isRunning) {
      start();
    }
    setMoreOpen(false);
    setSyncPanelOpen(true);
  }, [isRunning, start]);

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <>
      {/* Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-14 px-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-md transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-md transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              isMoreActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="More navigation options"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>All pages and settings</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-1 py-2">
              {moreNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleMoreNav(item.path)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      active && "bg-accent text-accent-foreground"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge}
                  </button>
                );
              })}
            </div>

            <Separator className="my-3" />

            {/* Sync button */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 mb-2"
              onClick={handleSync}
            >
              <RefreshCw
                className={cn("h-4 w-4", isRunning && "animate-spin")}
              />
              <span className="text-sm">
                {isRunning ? "Syncing... (tap to view)" : "Sync now"}
              </span>
            </Button>

            {/* Theme options */}
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Theme
              </p>
              <div className="flex gap-1 px-1">
                <Button
                  variant={theme === "light" ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme("light")}
                >
                  <Sun className="h-4 w-4 mr-1.5" />
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme("dark")}
                >
                  <Moon className="h-4 w-4 mr-1.5" />
                  Dark
                </Button>
                <Button
                  variant={theme === "system" ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme("system")}
                >
                  <Monitor className="h-4 w-4 mr-1.5" />
                  System
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Sync panel (shared with sidebar) */}
      <SyncPanel
        open={syncPanelOpen}
        onOpenChange={setSyncPanelOpen}
        events={events}
        isRunning={isRunning}
        onRetry={() => start()}
      />
    </>
  );
}
