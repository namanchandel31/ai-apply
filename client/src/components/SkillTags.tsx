import { Badge } from "@/components/ui/badge";

type SkillTagsProps = {
  skills?: string[];
  variant?: "default" | "secondary" | "success" | "destructive" | "warning";
  emptyLabel?: string;
};

export function SkillTags({
  skills,
  variant = "default",
  emptyLabel = "None detected",
}: SkillTagsProps) {
  if (!skills?.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <Badge key={skill} variant={variant}>
          {skill}
        </Badge>
      ))}
    </div>
  );
}
