import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface RequireICPContextProps {
  children: React.ReactNode;
}

export function RequireICPContext({ children }: RequireICPContextProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!location.state?.icpId) {
      toast({
        title: "ICP Required",
        description: "Please select an ICP from ICP Manager first",
        variant: "destructive"
      });
      navigate('/icp-manager');
    }
  }, [location, navigate, toast]);

  return location.state?.icpId ? <>{children}</> : null;
}
