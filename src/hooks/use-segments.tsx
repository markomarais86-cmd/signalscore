import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { useEffectiveOrg } from './use-effective-org';
import { useToast } from './use-toast';

export interface Segment {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  query_config: any;
  account_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useSegments() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { userProfile } = useAuth();
  const { effectiveOrgId } = useEffectiveOrg();
  const { toast } = useToast();

  const orgId = effectiveOrgId || userProfile?.org_id;

  const loadSegments = async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('segments')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSegments(data || []);
    } catch (error: any) {
      console.error('Error loading segments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load segments',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createSegment = async (segment: Partial<Segment>) => {
    if (!orgId) return null;

    try {
      const { data, error } = await supabase
        .from('segments')
        .insert([{
          org_id: orgId,
          created_by: userProfile?.user_id || null,
          name: segment.name || 'Untitled Segment',
          description: segment.description,
          query_config: segment.query_config || {},
          account_count: segment.account_count || 0,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Segment created successfully',
      });

      await loadSegments();
      return data;
    } catch (error: any) {
      console.error('Error creating segment:', error);
      toast({
        title: 'Error',
        description: 'Failed to create segment',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateSegment = async (id: string, updates: Partial<Segment>) => {
    try {
      const { error } = await supabase
        .from('segments')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Segment updated successfully',
      });

      await loadSegments();
    } catch (error: any) {
      console.error('Error updating segment:', error);
      toast({
        title: 'Error',
        description: 'Failed to update segment',
        variant: 'destructive',
      });
    }
  };

  const deleteSegment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('segments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Segment deleted successfully',
      });

      await loadSegments();
    } catch (error: any) {
      console.error('Error deleting segment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete segment',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadSegments();
  }, [orgId]);

  return {
    segments,
    isLoading,
    loadSegments,
    createSegment,
    updateSegment,
    deleteSegment,
  };
}
