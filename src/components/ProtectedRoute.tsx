import { useAuth } from '@/hooks/use-auth';
import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardSkeleton } from './DashboardSkeleton';

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
      console.log('ProtectedRoute: Prefetching dashboard data');
      
      // Prefetch dashboard metrics
      queryClient.prefetchQuery({
        queryKey: ['dashboard-metrics', userProfile.org_id],
        queryFn: async () => {
          const { data, error } = await supabase.rpc(
            'get_dashboard_metrics_fast' as any,
            { org_id: userProfile.org_id }
          );
          
          if (error) throw error;
          return data;
        },
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [user, userProfile, location.pathname, queryClient]);

  // Phase B: Show skeleton instead of spinner for better perceived performance
  if (loading && user === undefined) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}