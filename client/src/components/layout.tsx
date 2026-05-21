import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Briefcase, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { useLogout } from "@/auth/useLogout";
import { useAuthUserEmail } from "@/auth/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/setup", label: "Setup", icon: Settings },
] as const;

export function Layout() {
  const { data: status, isLoading, isSuccess, isError } = useSetupStatus();
  const handleLogout = useLogout();
  const userEmail = useAuthUserEmail();
  const setupLoaded = !isLoading && (isSuccess || isError);
  const setupIncomplete =
    setupLoaded && (!status?.hasResume || !status?.hasEmailSetup || !status?.hasAiSetup);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              A
            </div>
            <div>
              <h1 className="font-serif text-xl leading-tight">AI Apply</h1>
              <p className="text-xs text-muted-foreground">Productivity Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.to === "/setup" && setupIncomplete && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                    title="Setup incomplete"
                    aria-label="Setup incomplete"
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          {userEmail && (
            <p className="mb-3 truncate px-2 text-xs font-medium text-muted-foreground">
              {userEmail}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
