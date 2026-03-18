// AppShell -- main layout wrapper with sidebar (desktop) and bottom nav (mobile)
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="relative min-h-screen bg-background">
        {/* Skip navigation link for keyboard/screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:text-foreground focus:border focus:border-border focus:px-4 focus:py-2 focus:rounded-md focus:shadow-md"
        >
          Skip to main content
        </a>

        {/* Desktop sidebar -- fixed, hidden below md */}
        <Sidebar />

        {/* Main content area -- offset by sidebar width on desktop,
            padded at bottom on mobile for the tab bar */}
        <main
          id="main-content"
          className="relative md:pl-60 min-h-screen pb-16 md:pb-0"
        >
          <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom tab bar -- visible below md */}
        <MobileNav />
      </div>
    </TooltipProvider>
  );
}
