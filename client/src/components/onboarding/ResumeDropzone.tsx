import { useId, useRef, useState } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onFile: (file: File) => void;
  disabled?: boolean;
  busy?: boolean;
  formatsHint?: string;
};

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function ResumeDropzone({
  onFile,
  disabled = false,
  busy = false,
  formatsHint = "PDF format",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);
  const interactive = !disabled && !busy;

  const handleFile = (file: File | undefined) => {
    if (!file || disabled || busy) return;
    if (!isPdfFile(file)) {
      toast.error("Please upload a PDF file");
      return;
    }
    onFile(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={inputId}
        onDragEnter={(e) => {
          e.preventDefault();
          if (interactive) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (interactive) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-[10px] border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragOver ? "border-muted-foreground/40 bg-muted/60" : "border-border bg-muted/30",
          interactive ? "cursor-pointer hover:bg-muted/50" : "cursor-not-allowed opacity-60"
        )}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-base font-medium">Uploading…</span>
          </div>
        ) : (
          <>
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CloudUpload className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-base font-medium text-foreground">
              Choose a file or drag &amp; drop it here
            </p>
            <p className="mt-1.5 text-base text-muted-foreground">{formatsHint}</p>
            <span
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-5 pointer-events-none",
                disabled && "opacity-50"
              )}
            >
              Browse file
            </span>
          </>
        )}
      </label>
    </>
  );
}
