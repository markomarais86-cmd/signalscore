import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

interface UserRoles {
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  roles: string[];
  loading: boolean;
}

export function useRoles(): UserRoles {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Track if we've ever successfully fetched roles - prevents redirect flicker
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchRoles = async () => {
      // Don't reset loading to true if we've already loaded once
      // This prevents the flicker that causes redirects
      if (!hasLoadedOnce) {
        setLoading(true);
      }
      
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching user roles:', error);
          return;
        }

        if (mounted && data) {
          setRoles(data.map(r => r.role));
          setHasLoadedOnce(true);
        }
      } catch (error) {
        console.error('Error in fetchRoles:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchRoles();

    return () => {
      mounted = false;
    };
  }, [user, hasLoadedOnce]);

  return {
    isSuperAdmin: roles.includes('super_admin'),
    isOrgAdmin: roles.includes('org_admin'),
    roles,
    loading
  };
}
