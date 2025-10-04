import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface MergeResult {
  success: boolean;
  duplicate_groups_found: number;
  duplicate_accounts_merged: number;
  leads_updated: number;
  contacts_updated: number;
  scores_updated: number;
}

export function DuplicateAccountMerger() {
  const [isMerging, setIsMerging] = useState(false);
  const [result, setResult] = useState<MergeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMerge = async () => {
    setIsMerging(true);
    setError(null);
    setResult(null);

    try {
      // Get current user's org_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!userProfile) throw new Error('User profile not found');

      // Call the fast SQL merge function
      const { data, error: rpcError } = await supabase.rpc('merge_duplicate_accounts' as any, {
        p_org_id: userProfile.org_id
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const result = data as any as MergeResult;
      setResult(result);
      toast.success(`Merged ${result.duplicate_accounts_merged} duplicate accounts!`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to merge duplicates';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Merge error:', err);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Copy className="h-5 w-5" />
          Merge Duplicate Accounts
        </CardTitle>
        <CardDescription>
          Consolidate duplicate account records by normalizing domains and merging data.
          This will combine accounts with the same domain (e.g., "td.com", "www.td.com", "https://td.com").
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && !error && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This operation will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Normalize all account domains</li>
                <li>Merge duplicate accounts (keeping the most complete record)</li>
                <li>Re-link all leads, contacts, and scores to master accounts</li>
                <li>Delete duplicate account records</li>
              </ul>
              <p className="mt-2">This action cannot be undone. Make sure you have a backup.</p>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert className="bg-success/10 border-success">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription>
              <strong>✓ Merge Completed Successfully!</strong>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Duplicate groups found:</span>
                  <strong>{result.duplicate_groups_found}</strong>
                </div>
                <div className="flex justify-between text-success">
                  <span>Duplicate accounts merged:</span>
                  <strong>{result.duplicate_accounts_merged}</strong>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between">
                  <span>Leads updated:</span>
                  <strong>{result.leads_updated}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Contacts updated:</span>
                  <strong>{result.contacts_updated}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Scores updated:</span>
                  <strong>{result.scores_updated}</strong>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleMerge}
          disabled={isMerging}
          variant={result ? 'outline' : 'default'}
          className="w-full"
        >
          {isMerging ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Merging Duplicates...
            </>
          ) : result ? (
            'Run Merge Again'
          ) : (
            'Run Duplicate Merge'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
