import { useState } from "react";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function JsonViewer({ data, title }: { data: unknown; title?: string }) {
  const [open, setOpen] = useState(false);
  const text =
    data == null
      ? "null"
      : typeof data === "string"
        ? data
        : JSON.stringify(data, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title ?? "JSON"}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-7 px-2"
          onClick={(e) => {
            e.stopPropagation();
            void copy();
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </button>
      {open && (
        <pre className="max-h-64 overflow-auto border-t bg-muted/30 p-3 text-xs font-mono leading-relaxed">
          {text}
        </pre>
      )}
    </div>
  );
}
