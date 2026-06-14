import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PAGE_PADDING_X } from "@/lib/pageLayout";
import { OneTapBrand } from "@/components/OneTapLogomark";
import { UserMenu } from "@/components/UserMenu";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Apply" },
  { to: "/applications", label: "Applications" },
] as const;

export function Layout() {
  const { pathname } = useLocation();
  const hideHeader = pathname === "/setup";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {!hideHeader && (
      <header className="sticky top-0 z-40 bg-sidebar">
        <div className={cn("flex h-[56px] items-center gap-4", PAGE_PADDING_X)}>
          <OneTapBrand className="mr-20" />

          <nav className="flex h-full flex-1 items-stretch gap-6 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex h-full items-center border-b-2 px-1 text-base whitespace-nowrap transition-[color,border-color] duration-[120ms]",
                    isActive
                      ? "border-foreground font-medium text-foreground"
                      : "border-transparent font-normal text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center">
            <UserMenu />
          </div>
        </div>
      </header>
      )}

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
