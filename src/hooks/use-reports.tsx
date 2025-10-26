import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

export interface CustomReport {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  config: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportSchedule {
  id: string;
  org_id: string;
  report_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  last_run_at: string | null;
  next_run_at: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useReports() {
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const loadReports = async () => {
    if (!userProfile?.org_id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_reports')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      console.error('Error loading reports:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reports',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchedules = async () => {
    if (!userProfile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchedules((data || []) as ReportSchedule[]);
    } catch (error: any) {
      console.error('Error loading schedules:', error);
    }
  };

  const createReport = async (report: Partial<CustomReport>) => {
    if (!userProfile?.org_id) return null;

    try {
      const { data, error } = await supabase
        .from('custom_reports')
        .insert([{
          org_id: userProfile.org_id,
          created_by: userProfile.user_id,
          name: report.name || 'Untitled Report',
          description: report.description,
          template_id: report.template_id,
          config: report.config || {},
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Report created successfully',
      });

      await loadReports();
      return data;
    } catch (error: any) {
      console.error('Error creating report:', error);
      toast({
        title: 'Error',
        description: 'Failed to create report',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateReport = async (id: string, updates: Partial<CustomReport>) => {
    try {
      const { error } = await supabase
        .from('custom_reports')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Report updated successfully',
      });

      await loadReports();
    } catch (error: any) {
      console.error('Error updating report:', error);
      toast({
        title: 'Error',
        description: 'Failed to update report',
        variant: 'destructive',
      });
    }
  };

  const deleteReport = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Report deleted successfully',
      });

      await loadReports();
    } catch (error: any) {
      console.error('Error deleting report:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete report',
        variant: 'destructive',
      });
    }
  };

  const createSchedule = async (schedule: Partial<ReportSchedule>) => {
    if (!userProfile?.org_id) return null;

    try {
      const { data, error } = await supabase
        .from('report_schedules')
        .insert([{
          org_id: userProfile.org_id,
          report_id: schedule.report_id || '',
          frequency: schedule.frequency || 'weekly',
          recipients: schedule.recipients || [],
          enabled: schedule.enabled ?? true,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Schedule created successfully',
      });

      await loadSchedules();
      return data;
    } catch (error: any) {
      console.error('Error creating schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to create schedule',
        variant: 'destructive',
      });
      return null;
    }
  };

  useEffect(() => {
    loadReports();
    loadSchedules();
  }, [userProfile?.org_id]);

  return {
    reports,
    schedules,
    isLoading,
    loadReports,
    loadSchedules,
    createReport,
    updateReport,
    deleteReport,
    createSchedule,
  };
}
