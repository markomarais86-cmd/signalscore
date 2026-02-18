import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, Save, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { Json } from '@/integrations/supabase/types';

interface AttributeDefinition {
  id: string;
  field_key: string;
  field_label: string;
  field_type: 'number' | 'text' | 'select' | 'multi_select';
  options: string[];
}

interface BulkAttributeEditorProps {
  orgId: string;
  category: string;
  definitions: AttributeDefinition[];
}

interface AccountRow {
  id: string;
  name: string | null;
  domain: string | null;
  custom_attributes: Record<string, any> | null;
}

const PAGE_SIZE = 50;

export function BulkAttributeEditor({ orgId, category, definitions }: BulkAttributeEditorProps) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, Record<string, any>>>({});
  const { toast } = useToast();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('accounts')
        .select('id, name, domain, custom_attributes', { count: 'exact' })
        .eq('org_id', orgId)
        .order('name', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,domain.ilike.%${debouncedSearch}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      setAccounts((data as AccountRow[]) || []);
      setTotalCount(count || 0);
    } catch (e: any) {
      toast({ title: 'Error loading accounts', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [orgId, page, debouncedSearch, toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasChanges = Object.keys(changes).length > 0;
  const changedCount = Object.keys(changes).length;

  const getValue = (account: AccountRow, fieldKey: string) => {
    // Check local changes first
    if (changes[account.id]?.[fieldKey] !== undefined) {
      return changes[account.id][fieldKey];
    }
    return (account.custom_attributes as any)?.[fieldKey] ?? '';
  };

  const setValue = (accountId: string, fieldKey: string, value: any) => {
    setChanges(prev => ({
      ...prev,
      [accountId]: {
        ...(prev[accountId] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const entries = Object.entries(changes);
      for (const [accountId, fieldChanges] of entries) {
        const account = accounts.find(a => a.id === accountId);
        const existing = (account?.custom_attributes as Record<string, any>) || {};
        const merged = { ...existing, ...fieldChanges };

        const { error } = await supabase
          .from('accounts')
          .update({ custom_attributes: merged as unknown as Json })
          .eq('id', accountId);

        if (error) {
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (errorCount > 0) {
        toast({ title: 'Partial save', description: `${successCount} saved, ${errorCount} failed`, variant: 'destructive' });
      } else {
        toast({ title: 'Saved', description: `Updated ${successCount} account${successCount !== 1 ? 's' : ''}` });
      }

      setChanges({});
      fetchAccounts();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleMultiSelect = (accountId: string, fieldKey: string, option: string, currentValues: string[]) => {
    const next = currentValues.includes(option)
      ? currentValues.filter(v => v !== option)
      : [...currentValues, option];
    setValue(accountId, fieldKey, next);
  };

  return (
    <div className="space-y-3 mt-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts by name or domain..."
            className="pl-9 h-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {totalCount.toLocaleString()} accounts
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hasChanges && (
            <>
              <Badge variant="secondary" className="gap-1">
                {changedCount} unsaved
              </Badge>
              <Button size="sm" variant="outline" onClick={() => setChanges({})}>
                <X className="h-3.5 w-3.5 mr-1" />
                Discard
              </Button>
            </>
          )}
          <Button size="sm" disabled={!hasChanges || saving} onClick={handleSave}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px] sticky left-0 bg-background z-10">Account</TableHead>
              <TableHead className="w-[140px]">Domain</TableHead>
              {definitions.map(def => (
                <TableHead key={def.field_key} className="min-w-[150px]">
                  {def.field_label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={2 + definitions.length} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2 + definitions.length} className="text-center py-8 text-muted-foreground">
                  No accounts found
                </TableCell>
              </TableRow>
            ) : (
              accounts.map(account => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium sticky left-0 bg-background z-10 truncate max-w-[180px]">
                    {account.name || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs truncate max-w-[140px]">
                    {account.domain || '—'}
                  </TableCell>
                  {definitions.map(def => {
                    const val = getValue(account, def.field_key);
                    const isDirty = changes[account.id]?.[def.field_key] !== undefined;

                    if (def.field_type === 'number') {
                      return (
                        <TableCell key={def.field_key}>
                          <Input
                            type="number"
                            value={val ?? ''}
                            onChange={e => setValue(account.id, def.field_key, e.target.value === '' ? null : Number(e.target.value))}
                            className={`h-8 w-full ${isDirty ? 'border-primary ring-1 ring-primary/30' : ''}`}
                          />
                        </TableCell>
                      );
                    }

                    if (def.field_type === 'select') {
                      return (
                        <TableCell key={def.field_key}>
                          <Select
                            value={val || ''}
                            onValueChange={v => setValue(account.id, def.field_key, v)}
                          >
                            <SelectTrigger className={`h-8 ${isDirty ? 'border-primary ring-1 ring-primary/30' : ''}`}>
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {def.options.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      );
                    }

                    if (def.field_type === 'multi_select') {
                      const currentArr: string[] = Array.isArray(val) ? val : [];
                      return (
                        <TableCell key={def.field_key}>
                          <div className={`flex flex-wrap gap-1 p-1 border rounded-md min-h-[32px] ${isDirty ? 'border-primary ring-1 ring-primary/30' : 'border-input'}`}>
                            {def.options.map(opt => {
                              const selected = currentArr.includes(opt);
                              return (
                                <Badge
                                  key={opt}
                                  variant={selected ? 'default' : 'outline'}
                                  className="text-[10px] cursor-pointer px-1.5 py-0"
                                  onClick={() => toggleMultiSelect(account.id, def.field_key, opt, currentArr)}
                                >
                                  {opt}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                      );
                    }

                    // text
                    return (
                      <TableCell key={def.field_key}>
                        <Input
                          type="text"
                          value={val ?? ''}
                          onChange={e => setValue(account.id, def.field_key, e.target.value || null)}
                          className={`h-8 w-full ${isDirty ? 'border-primary ring-1 ring-primary/30' : ''}`}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page + 1} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
