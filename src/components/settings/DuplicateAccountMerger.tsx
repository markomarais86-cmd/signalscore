import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface MergeResult {
  org_id: string;
  total_accounts_before: number;
  total_accounts_after: number;
  duplicates_merged: number;
  accounts_deleted: number;
  leads_relinked: number;
  contacts_relinked: number;
  scores_relinked: number;
  domains_processed: string[];
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
      const { data, error: invokeError } = await supabase.functions.invoke(
        'merge-duplicate-accounts',
        {
          method: 'POST',
        }
      );

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      setResult(data as MergeResult);
      toast.success('Duplicate accounts merged successfully!');
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
              <strong>Merge Completed Successfully!</strong>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Accounts before:</span>
                  <strong>{result.total_accounts_before}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Accounts after:</span>
                  <strong>{result.total_accounts_after}</strong>
                </div>
                <div className="flex justify-between text-success">
                  <span>Duplicates merged:</span>
                  <strong>{result.duplicates_merged}</strong>
                </div>
                <div className="flex justify-between text-success">
                  <span>Accounts deleted:</span>
                  <strong>{result.accounts_deleted}</strong>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between">
                  <span>Leads re-linked:</span>
                  <strong>{result.leads_relinked}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Contacts re-linked:</span>
                  <strong>{result.contacts_relinked}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Scores re-linked:</span>
                  <strong>{result.scores_relinked}</strong>
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
