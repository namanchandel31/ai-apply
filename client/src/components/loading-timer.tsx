import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type LoadingTimerProps = {
  label: string;
  startedAt: number;
};

export function LoadingTimer({ label, startedAt }: LoadingTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const update = () => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  // Max expected time is 90s, progress scales 0 -> 100
  const progressValue = Math.min((elapsed / 90) * 100, 95); // cap at 95% until actually done

  return (
    <div className="flex flex-col gap-2 w-full mt-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-mono text-muted-foreground ml-auto">{elapsed}s elapsed</span>
      </div>
      <Progress value={progressValue} className="h-1 w-full bg-muted/50" />
      <p className="text-[10px] text-muted-foreground">This may take up to 90 seconds</p>
    </div>
  );
}
