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
        {/* Desktop sidebar -- fixed, hidden below md */}
        <Sidebar />

        {/* Main content area -- offset by sidebar width on desktop,
            padded at bottom on mobile for the tab bar */}
        <main
          className="relative md:pl-60 min-h-screen pb-16 md:pb-0"
          role="main"
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
