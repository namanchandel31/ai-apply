import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { useLogout } from "@/auth/useLogout";
import { useAuthUserEmail } from "@/auth/AuthContext";

const SIDEBAR_STORAGE_KEY = "onetap_sidebar_collapsed";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/setup", label: "Setup", icon: Settings },
] as const;

const SIDEBAR_WIDTH_EXPANDED = "16rem";
const SIDEBAR_WIDTH_COLLAPSED = "4rem";

export function Layout() {
  const { data: status, isLoading, isSuccess, isError } = useSetupStatus();
  const handleLogout = useLogout();
  const userEmail = useAuthUserEmail();
  const setupLoaded = !isLoading && (isSuccess || isError);
  const setupIncomplete =
    setupLoaded && (!status?.hasResume || !status?.hasEmailSetup || !status?.hasAiSetup);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        style={{ width: sidebarWidth }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card",
          "transition-[width] duration-200 ease-in-out"
        )}
      >
        <div className="flex shrink-0 items-center border-b border-border p-3">
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3",
              collapsed && "justify-center"
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              A
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="font-serif text-xl leading-tight truncate">AI Apply</h1>
                <p className="text-xs text-muted-foreground truncate">Productivity Platform</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center border-b border-border py-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                    collapsed ? "relative justify-center px-2" : "gap-3 px-3",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && item.to === "/setup" && setupIncomplete && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                    title="Setup incomplete"
                    aria-label="Setup incomplete"
                  />
                )}
                {collapsed && item.to === "/setup" && setupIncomplete && (
                  <span
                    className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500"
                    aria-label="Setup incomplete"
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border p-2">
          {!collapsed && userEmail && (
            <p className="mb-2 truncate px-2 text-xs font-medium text-muted-foreground">
              {userEmail}
            </p>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              collapsed ? "mx-auto h-9 w-9" : "w-full justify-start"
            )}
            onClick={handleLogout}
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
            {!collapsed && "Sign out"}
          </Button>
        </div>
      </aside>

      <main
        style={{ marginLeft: sidebarWidth }}
        className="min-h-screen transition-[margin-left] duration-200 ease-in-out"
      >
        <div className="h-full overflow-y-auto overflow-x-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
