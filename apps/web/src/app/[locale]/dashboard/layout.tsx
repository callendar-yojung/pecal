"use client";

import { useState, useEffect } from "react";
import { Sidebar, NotificationsBell } from "@/components/dashboard";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";

const DEFAULT_SIDEBAR_WIDTH = 256;
const MOBILE_BREAKPOINT = 1024;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Load initial width from localStorage
    const savedWidth = localStorage.getItem("sidebarWidth");
    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth, 10));
    }

    // Listen for sidebar resize events
    const handleResize = (e: CustomEvent<{ width: number }>) => {
      setSidebarWidth(e.detail.width);
    };

    window.addEventListener("sidebarResize", handleResize as EventListener);

    return () => {
      window.removeEventListener("sidebarResize", handleResize as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <WorkspaceProvider>
      <div className="min-h-screen bg-dashboard-background">
        <Sidebar
          isMobile={isMobile}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        {isMobile && mobileOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            className="fixed inset-0 z-30 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
        )}
        {isMobile && (
          <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-sidebar-border bg-sidebar-background px-4 py-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="ui-button px-2 py-1 text-sm"
            >
              Menu
            </button>
            <span className="text-sm font-semibold text-foreground">
              Dashboard
            </span>
            <div className="ml-auto">
              <NotificationsBell />
            </div>
          </div>
        )}
        <main
          style={{
            paddingLeft: isMobile ? "0px" : `${sidebarWidth}px`,
          }}
          className="transition-[padding-left] duration-0"
        >
          {!isMobile && (
            <div className="sticky top-0 z-20 flex justify-end border-b border-border bg-background/80 px-8 py-3 backdrop-blur">
              <NotificationsBell />
            </div>
          )}
          <div className={isMobile ? "p-4" : "p-8"}>{children}</div>
        </main>
      </div>
    </WorkspaceProvider>
  );
}
