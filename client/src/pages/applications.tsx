import { ApplicationTable } from "@/components/ApplicationTable";

export function Applications() {
  return (
    <div className="p-8 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Applications</h1>
        <p className="mt-1 text-muted-foreground">
          Track the status of your AI-tailored job applications.
        </p>
      </div>

      <ApplicationTable />
    </div>
  );
}
