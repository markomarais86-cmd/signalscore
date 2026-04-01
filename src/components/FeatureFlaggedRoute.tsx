import { Navigate } from "react-router-dom";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

interface FeatureFlaggedRouteProps {
  flag: keyof ReturnType<typeof useFeatureFlags>["flags"];
  children: React.ReactNode;
  fallback?: string;
}

/** Renders children only if the feature flag is enabled, otherwise redirects */
export function FeatureFlaggedRoute({ flag, children, fallback = "/dashboard" }: FeatureFlaggedRouteProps) {
  const { flags, isLoading } = useFeatureFlags();
  
  if (isLoading) return null;
  if (!flags[flag]) return <Navigate to={fallback} replace />;
  
  return <>{children}</>;
}
