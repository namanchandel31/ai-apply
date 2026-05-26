import { ApplicationsDashboard } from "@/components/applications/ApplicationsDashboard";

export function Applications() {
  const disableTable =
    typeof window !== "undefined" && window.localStorage.getItem("debug:disableApplicationsTable") === "1";
  if (disableTable) {
    return <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full">test</div>;
  }
  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full">
      <ApplicationsDashboard />
    </div>
  );
}
