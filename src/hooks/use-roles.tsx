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

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchRoles = async () => {
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
  }, [user]);

  return {
    isSuperAdmin: roles.includes('super_admin'),
    isOrgAdmin: roles.includes('org_admin'),
    roles,
    loading
  };
}
