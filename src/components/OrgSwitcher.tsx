import { Building2, ArrowLeft } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useOrgSwitcher } from '@/contexts/OrgSwitcherContext';
import { useRoles } from '@/hooks/use-roles';

export function OrgSwitcher() {
  const { isSuperAdmin } = useRoles();
  const {
    effectiveOrgId,
    organizations,
    isImpersonating,
    isLoadingOrgs,
    setSelectedOrgId,
    resetToOwnOrg,
  } = useOrgSwitcher();

  if (!isSuperAdmin) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select
        value={effectiveOrgId ?? ''}
        onValueChange={(val) => {
          if (val === '__own__') {
            resetToOwnOrg();
          } else {
            setSelectedOrgId(val);
          }
        }}
        disabled={isLoadingOrgs}
      >
        <SelectTrigger className="h-8 w-[200px] text-xs">
          <SelectValue placeholder={isLoadingOrgs ? 'Loading…' : 'Select org'} />
        </SelectTrigger>
        <SelectContent>
          {isImpersonating && (
            <SelectItem value="__own__" className="text-xs">
              <span className="flex items-center gap-1.5">
                <ArrowLeft className="h-3 w-3" />
                Back to my org
              </span>
            </SelectItem>
          )}
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id} className="text-xs">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      org.status === 'active'
                        ? 'hsl(var(--chart-2))'
                        : 'hsl(var(--muted-foreground))',
                  }}
                />
                {org.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isImpersonating && (
        <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400 whitespace-nowrap">
          Viewing as client
        </Badge>
      )}
    </div>
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
