import { useNavigate } from "react-router-dom";
import { ChevronDown, CreditCard, Gift, LogOut, Puzzle, Settings, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { useLogout } from "@/auth/useLogout";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { getDisplayFirstName, getUserInitials } from "@/lib/userDisplay";
import { getSubscriptionMenuBadge, isFreeTrialUser } from "@/lib/subscriptionDisplay";
import { usageQueryOptions } from "@/queries/bootstrapQueries";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserAvatarProps = {
  avatarUrl?: string | null;
  initials: string;
  className?: string;
};

function UserAvatar({ avatarUrl, initials, className }: UserAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn("h-8 w-8 shrink-0 rounded-full object-cover", className)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground",
        className
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function UserMenu() {
  const { user } = useAuth();
  const handleLogout = useLogout();
  const navigate = useNavigate();
  const { data: status, isLoading, isSuccess, isError } = useSetupStatus();
  const onFreeTrial = isFreeTrialUser(status);
  const { data: usage } = useQuery({
    ...usageQueryOptions,
    enabled: Boolean(user) && onFreeTrial,
  });

  if (!user) return null;

  const displayName = getDisplayFirstName(user);
  const initials = getUserInitials(user);
  const setupLoaded = !isLoading && (isSuccess || isError);
  const setupIncomplete =
    setupLoaded && (!status?.hasResume || !status?.hasEmailSetup || !status?.hasAiSetup);
  const planBadge = getSubscriptionMenuBadge(status);
  const applicationQuota = usage?.quota_applications_sent;
  const showTrialQuota =
    onFreeTrial &&
    applicationQuota &&
    !applicationQuota.unlimited &&
    applicationQuota.limit >= 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-tour="setup-entry"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-base font-normal text-muted-foreground transition-[background-color,color] duration-[120ms] hover:bg-black/[0.05] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          <UserAvatar avatarUrl={user.avatarUrl} initials={initials} />
          <div className="hidden min-w-0 flex-col items-start sm:flex">
            <span className="max-w-[120px] truncate">{displayName}</span>
            {planBadge ? (
              <span className="max-w-[140px] truncate text-xs text-muted-foreground">{planBadge}</span>
            ) : null}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {planBadge ? (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Your plan</span>
                <span className="text-sm font-medium text-foreground">{planBadge}</span>
                {showTrialQuota ? (
                  <div className="space-y-0.5 pt-0.5 text-sm text-muted-foreground">
                    <p>
                      {applicationQuota.limit} application{applicationQuota.limit === 1 ? "" : "s"}{" "}
                      in free trial
                    </p>
                    <p>
                      Remaining:{" "}
                      <span className="tabular-nums font-medium text-foreground">
                        {applicationQuota.remaining}
                      </span>
                    </p>
                  </div>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          onSelect={() => navigate("/setup")}
          className="relative"
        >
          <Settings className="mr-2 h-4 w-4" />
          Setup
          {setupIncomplete && (
            <span
              className="ml-auto h-2 w-2 rounded-full bg-warning"
              title="Setup incomplete"
              aria-label="Setup incomplete"
            />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/settings/extension")}>
          <Puzzle className="mr-2 h-4 w-4" />
          Chrome Extension
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/referrals")}>
          <Gift className="mr-2 h-4 w-4" />
          Refer & earn
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/subscriptions")}>
          <CreditCard className="mr-2 h-4 w-4" />
          Subscription
        </DropdownMenuItem>
        {user.isAdmin && (
          <DropdownMenuItem onSelect={() => navigate("/admin")}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handleLogout()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
