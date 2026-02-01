import { useAuth } from '@/hooks/use-auth';
import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardSkeleton } from './DashboardSkeleton';
import { authLogger } from '@/lib/logger';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Phase B: Prefetch dashboard data as soon as user is authenticated
  useEffect(() => {
    if (user && userProfile?.org_id && location.pathname === '/') {
      authLogger.debug('Prefetching dashboard data');
      
      // Prefetch dashboard metrics
      // Prefetch using the same cached function as useDashboardData
      queryClient.prefetchQuery({
        queryKey: ['dashboard-metrics', userProfile.org_id, 'crm'],
        queryFn: async () => {
          const { data, error } = await supabase.rpc(
            'get_dashboard_metrics_cached' as any,
            { p_org_id: userProfile.org_id }
          );
          
          if (error) throw error;
          return data;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes - aligned with useDashboardData
      });
    }
  }, [user, userProfile, location.pathname, queryClient]);

  // Phase B: Show skeleton instead of spinner for better perceived performance
  if (loading && user === undefined) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <Navigate to="/landing" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}