import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface DeduplicationResult {
  duplicateEmails: Set<string>;
  recentExports: Array<{
    icp_name: string;
    exported_at: string;
    total_contacts: number;
  }>;
  isLoading: boolean;
}

export function useCampaignDeduplication(emails: string[]): DeduplicationResult {
  const { userProfile } = useAuth();
  const [duplicateEmails, setDuplicateEmails] = useState<Set<string>>(new Set());
  const [recentExports, setRecentExports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userProfile?.org_id || emails.length === 0) {
      setDuplicateEmails(new Set());
      setRecentExports([]);
      return;
    }

    checkDuplicates();
  }, [userProfile?.org_id, emails]);

  const checkDuplicates = async () => {
    if (!userProfile?.org_id) return;

    setIsLoading(true);
    try {
      // Query campaign_snapshots for exports in last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: snapshots, error } = await supabase
        .from('campaign_snapshots')
        .select('icp_name, exported_at, total_contacts, exported_emails')
        .eq('org_id', userProfile.org_id)
        .gte('exported_at', ninetyDaysAgo.toISOString())
        .order('exported_at', { ascending: false });

      if (error) throw error;

      // Extract all previously exported emails
      const allExportedEmails = new Set<string>();
      (snapshots || []).forEach((snapshot) => {
        const emailsList = snapshot.exported_emails as string[] | null;
        if (emailsList && Array.isArray(emailsList)) {
          emailsList.forEach((email) => allExportedEmails.add(email.toLowerCase()));
        }
      });

      // Find duplicates
      const dupes = new Set<string>();
      emails.forEach((email) => {
        if (allExportedEmails.has(email.toLowerCase())) {
          dupes.add(email);
        }
      });

      setDuplicateEmails(dupes);
      setRecentExports(snapshots || []);
    } catch (error) {
      console.error('[Deduplication] Error checking duplicates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { duplicateEmails, recentExports, isLoading };
}
