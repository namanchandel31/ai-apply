import { useState, useRef } from "react";
import { Loader2, FileText, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  activeResume: { filename: string; uploadedAt: string; fileHash: string } | null | undefined;
  onUpdate: () => void;
}

export function ResumeStatusCard({ activeResume, onUpdate }: Props) {
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
          ? "This resume is already on file — kept as your active resume"
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
    <Card className={!activeResume ? "border-amber-500/50" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume Management
          </CardTitle>
          <CardDescription>
            Upload your master resume. It will be used for all future applications.
          </CardDescription>
        </div>
        {activeResume && (
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Ready
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {activeResume ? (
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{activeResume.filename}</p>
                <p className="text-xs text-muted-foreground">
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
        ) : (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg bg-muted/20 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
            <p className="font-medium text-sm mb-1">Resume Required</p>
            <p className="text-xs text-muted-foreground mb-4">Upload a PDF resume before applying to jobs.</p>
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
