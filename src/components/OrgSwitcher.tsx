import { useState } from 'react';
import { Building2, ArrowLeft, Plus, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrgSwitcher } from '@/contexts/OrgSwitcherContext';
import { useRoles } from '@/hooks/use-roles';
import { QuickCreateOrgDialog } from '@/components/QuickCreateOrgDialog';
import { cn } from '@/lib/utils';

export function OrgSwitcher() {
  const { isSuperAdmin } = useRoles();
  const {
    effectiveOrgId,
    selectedOrg,
    organizations,
    isImpersonating,
    isLoadingOrgs,
    setSelectedOrgId,
    resetToOwnOrg,
    refreshOrgs,
  } = useOrgSwitcher();

  const [open, setOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  if (!isSuperAdmin) return null;

  const handleCreateSuccess = async (newOrgId: string) => {
    await refreshOrgs();
    setSelectedOrgId(newOrgId);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-8 w-[200px] justify-between text-xs font-normal"
              disabled={isLoadingOrgs}
            >
              <span className="truncate">
                {isLoadingOrgs ? 'Loading…' : selectedOrg?.name ?? 'Select org'}
              </span>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search orgs…" className="h-9 text-xs" />
              <CommandList>
                <CommandEmpty className="text-xs">No organization found.</CommandEmpty>
                <CommandGroup>
                  {isImpersonating && (
                    <CommandItem
                      onSelect={() => {
                        resetToOwnOrg();
                        setOpen(false);
                      }}
                      className="text-xs"
                    >
                      <ArrowLeft className="mr-1.5 h-3 w-3" />
                      Back to my org
                    </CommandItem>
                  )}
                  {organizations.map((org) => (
                    <CommandItem
                      key={org.id}
                      value={org.name}
                      onSelect={() => {
                        setSelectedOrgId(org.id);
                        setOpen(false);
                      }}
                      className="text-xs"
                    >
                      <span
                        className="mr-1.5 h-2 w-2 rounded-full shrink-0 inline-block"
                        style={{
                          backgroundColor:
                            org.status === 'active'
                              ? 'hsl(var(--chart-2))'
                              : 'hsl(var(--muted-foreground))',
                        }}
                      />
                      <span className="truncate">{org.name}</span>
                      <Check
                        className={cn(
                          'ml-auto h-3 w-3',
                          effectiveOrgId === org.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      setQuickCreateOpen(true);
                    }}
                    className="text-xs"
                  >
                    <Plus className="mr-1.5 h-3 w-3" />
                    New Organization
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {isImpersonating && (
          <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400 whitespace-nowrap">
            Viewing as client
          </Badge>
        )}
      </div>

      <QuickCreateOrgDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}

export function ImpersonationBanner() {
  const { isSuperAdmin } = useRoles();
  const { isImpersonating, selectedOrg, resetToOwnOrg } = useOrgSwitcher();

  if (!isSuperAdmin || !isImpersonating || !selectedOrg) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-1.5 flex items-center justify-between">
      <span className="text-xs text-amber-700 dark:text-amber-400">
        Viewing data for: <strong>{selectedOrg.name}</strong>
      </span>
      <button
        onClick={resetToOwnOrg}
        className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-medium"
      >
        Exit
      </button>
    </div>
  );
}
