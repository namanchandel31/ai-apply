import { MoreHorizontal, Eye, RefreshCw, Play, Copy, Mail, Send } from "lucide-react";
import type { ApplicationRecord } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type Props = {
  app: ApplicationRecord;
  onViewDetails: () => void;
  onRetry: () => void;
  onContinue: () => void;
  onSend?: () => void;
  disabled?: boolean;
};

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Copy failed");
  }
}

export function ApplicationRowActions({
  app,
  onViewDetails,
  onRetry,
  onContinue,
  onSend,
  disabled,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onViewDetails}>
          <Eye className="mr-2 h-4 w-4" />
          View details
        </DropdownMenuItem>
        {app.canRetry && (
          <DropdownMenuItem onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </DropdownMenuItem>
        )}
        {app.canContinue && (
          <DropdownMenuItem onClick={onContinue}>
            <Play className="mr-2 h-4 w-4" />
            Continue send…
          </DropdownMenuItem>
        )}
        {app.canSend && onSend && (
          <DropdownMenuItem onClick={onSend}>
            <Send className="mr-2 h-4 w-4" />
            Send
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void copyText("Application ID", app.id)}>
          <Copy className="mr-2 h-4 w-4" />
          Copy ID
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MailCopyAction({ email }: { email?: string | null }) {
  if (!email) return null;
  return (
    <DropdownMenuItem onClick={() => void copyText("Email", email)}>
      <Mail className="mr-2 h-4 w-4" />
      Copy recipient email
    </DropdownMenuItem>
  );
}
