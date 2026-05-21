import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { logout } from "@/auth/logout";

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  return () => {
    logout(queryClient, navigate);
    setUser(null);
    toast.info("Signed out");
  };
}
