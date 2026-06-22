import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, CreditCard, Gift, Loader2, LogOut, Puzzle, Settings, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { useLogout } from "@/auth/useLogout";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { api } from "@/lib/api";
import { getDisplayFirstName, getUserInitials } from "@/lib/userDisplay";
import { getSubscriptionMenuBadge } from "@/lib/subscriptionDisplay";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

function ProfileEditSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next && user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
    }
    onOpenChange(next);
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }
    setSaving(true);
    try {
      await api.patchProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await refreshUser();
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>Update how your name appears in OneTap.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-2">
            <Label htmlFor="profile-first-name">First name</Label>
            <Input
              id="profile-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-last-name">Last name</Label>
            <Input
              id="profile-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function UserMenu() {
  const { user } = useAuth();
  const handleLogout = useLogout();
  const navigate = useNavigate();
  const { data: status, isLoading, isSuccess, isError } = useSetupStatus();
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) return null;

  const displayName = getDisplayFirstName(user);
  const initials = getUserInitials(user);
  const setupLoaded = !isLoading && (isSuccess || isError);
  const setupIncomplete =
    setupLoaded && (!status?.hasResume || !status?.hasEmailSetup || !status?.hasAiSetup);
  const planBadge = getSubscriptionMenuBadge(status);

  return (
    <>
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
        <DropdownMenuContent align="end" className="w-56">
          {planBadge ? (
            <>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Your plan</span>
                  <span className="text-sm font-medium text-foreground">{planBadge}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            <UserRound className="mr-2 h-4 w-4" />
            Edit profile
          </DropdownMenuItem>
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

      <ProfileEditSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
