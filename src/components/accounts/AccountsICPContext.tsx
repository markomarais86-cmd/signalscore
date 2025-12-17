import { useNavigate } from "react-router-dom";
import { Target, Edit, X, ChevronDown, Building2, Globe, Briefcase, TrendingUp, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatNumber } from "@/utils/format-numbers";

interface ICPContext {
  icpId?: string;
  icpName?: string;
  prefilters?: {
    industries?: string[];
    geographies?: string[];
    companySizes?: number[];
    revenueRanges?: string[];
  };
}

interface AccountsICPContextProps {
  icpContext: ICPContext;
  icpDetailsOpen: boolean;
  setIcpDetailsOpen: (open: boolean) => void;
  icpIndustries: string[];
  icpGeographies: string[];
  icpSizes: number[];
  icpRevenues: string[];
  onClearContext: () => void;
}

export function AccountsICPContext({
  icpContext,
  icpDetailsOpen,
  setIcpDetailsOpen,
  icpIndustries,
  icpGeographies,
  icpSizes,
  icpRevenues,
  onClearContext,
}: AccountsICPContextProps) {
  const navigate = useNavigate();

  return (
    <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-secondary/5">
      <Collapsible open={icpDetailsOpen} onOpenChange={setIcpDetailsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">ICP Context: {icpContext.icpName}</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Account filters are automatically applied from this ICP
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/icp-manager', { state: { editIcpId: icpContext.icpId } })}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit ICP
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onClearContext}
              >
                <X className="h-4 w-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronDown className={`h-4 w-4 transition-transform ${icpDetailsOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Industries */}
            {icpIndustries.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Target Industries ({icpIndustries.length})</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {icpIndustries.map(industry => (
                    <Badge key={industry} variant="secondary">
                      {industry}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Geographies */}
            {icpGeographies.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Target Countries ({icpGeographies.length})</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {icpGeographies.map(country => (
                    <Badge key={country} variant="secondary">
                      {country}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Company Sizes */}
            {icpSizes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Company Sizes ({icpSizes.length} ranges)</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {icpSizes.map((size, index) => {
                    const nextSize = icpSizes[index + 1];
                    const label = nextSize 
                      ? `${formatNumber(size)}-${formatNumber(nextSize - 1)} employees` 
                      : `${formatNumber(size)}+ employees`;
                    return (
                      <Badge key={size} variant="secondary">
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Revenue Ranges */}
            {icpRevenues.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Revenue Ranges ({icpRevenues.length})</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {icpRevenues.map(rev => (
                    <Badge key={rev} variant="secondary">
                      {rev}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Alert className="bg-muted/50 border-0">
              <Sparkles className="h-4 w-4" />
              <AlertDescription className="text-xs">
                All accounts shown below match these ICP criteria. Use additional filters to further refine results.
              </AlertDescription>
            </Alert>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
