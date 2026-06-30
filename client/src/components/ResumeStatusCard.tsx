import { useState, useRef } from "react";
import { Loader2, FileText, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SETUP_BOX_RADIUS = "rounded-sm";

interface Props {
  activeResume: { filename: string; uploadedAt: string; fileHash: string } | null | undefined;
  hasValidResume?: boolean;
  resumeParseStatus?: "missing" | "processing" | "failed" | "ready";
  resumeParseError?: string | null;
  onUpdate: () => void;
}

export function ResumeStatusCard({
  activeResume,
  hasValidResume = false,
  resumeParseStatus,
  resumeParseError,
  onUpdate,
}: Props) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const res = await api.uploadResume(file);
      const deduplicated = Boolean(
        (res as { deduplicated?: boolean }).deduplicated
      );
      toast.success(
        deduplicated
          ? "This resume is already on file, kept as your active resume"
          : "Resume parsed and saved"
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn(SETUP_BOX_RADIUS, !activeResume ? "ring-1 ring-warning/40" : "")}>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <FileText className="h-5 w-5" />
            Resume Management
          </CardTitle>
          <CardDescription>
            Upload your master resume. It will be used for all future applications.
          </CardDescription>
        </div>
        {activeResume && (
          <Badge
            variant={
              hasValidResume ? "success" : resumeParseStatus === "failed" ? "destructive" : "secondary"
            }
          >
            {hasValidResume ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" /> Ready
              </>
            ) : resumeParseStatus === "failed" ? (
              "Parse failed"
            ) : (
              "Parsing…"
            )}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {activeResume ? (
          <div className="space-y-3">
            <div className={cn("flex items-center justify-between border border-input-border bg-input p-3", SETUP_BOX_RADIUS)}>
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-base font-medium">{activeResume.filename}</p>
                  <p className="text-base text-muted-foreground">
                    Uploaded {new Date(activeResume.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="application/pdf"
                  onChange={handleUpload}
                />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Replace
                </Button>
              </div>
            </div>
            {resumeParseStatus === "failed" && resumeParseError ? (
              <p className="text-sm text-destructive">{resumeParseError}</p>
            ) : null}
          </div>
        ) : (
          <div className={cn("flex flex-col items-center justify-center border border-dashed border-border bg-muted/10 p-6 text-center", SETUP_BOX_RADIUS)}>
            <FileText className="mb-3 h-10 w-10 text-muted-foreground opacity-50" />
            <p className="mb-1 text-base font-medium">Resume Required</p>
            <p className="mb-4 text-base text-muted-foreground">Upload a PDF resume before applying to jobs.</p>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="application/pdf"
              onChange={handleUpload}
            />
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload Resume
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
