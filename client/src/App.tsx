import { AppRoutes } from "@/routes/AppRoutes";
import { SetupStatusBootstrap } from "@/components/SetupStatusBootstrap";

export default function App() {
  return (
    <>
      <SetupStatusBootstrap />
      <AppRoutes />
    </>
  );
}
