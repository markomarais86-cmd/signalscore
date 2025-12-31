import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target, MapPin, Building2, DollarSign, Clock } from "lucide-react";
import { LaunchPulseMark } from '@/components/BrandLogo';
import { useNavigate } from "react-router-dom";

interface RecommendationData {
  recommendation: string;
  dataAnalysis: {
    totalAccounts: number;
    topIndustries: string[];
    topCountries: string[];
    revenueRanges: string[];
    companySizes: string[];
  };
}

interface ICPRecommendationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: RecommendationData | null;
}

export function ICPRecommendationDialog({
  open,
  onOpenChange,
  data
}: ICPRecommendationDialogProps) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const handleCreateICP = () => {
    setCreating(true);
    // Navigate to ICP wizard with pre-filled data
    navigate('/icp-manager', {
      state: {
        recommendation: data,
        autoFill: true
      }
    });
    onOpenChange(false);
    setCreating(false);
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LaunchPulseMark className="h-5 w-5 text-primary" />
            AI-Generated ICP Recommendation
          </DialogTitle>
          <DialogDescription>
            Based on analysis of {data.dataAnalysis.totalAccounts} accounts in your CRM
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main Recommendation */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Recommended ICP</h3>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {data.recommendation}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Insights Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Industries */}
            {data.dataAnalysis.topIndustries.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">Top Industries</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.dataAnalysis.topIndustries.map((industry, idx) => (
                      <Badge key={idx} variant="outline">
                        {industry}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Geographies */}
            {data.dataAnalysis.topCountries.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">Top Geographies</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.dataAnalysis.topCountries.map((country, idx) => (
                      <Badge key={idx} variant="outline">
                        {country}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Company Sizes */}
            {data.dataAnalysis.companySizes.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">Company Sizes</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.dataAnalysis.companySizes.map((size, idx) => (
                      <Badge key={idx} variant="outline">
                        {size} employees
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Revenue Ranges */}
            {data.dataAnalysis.revenueRanges.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">Revenue Ranges</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.dataAnalysis.revenueRanges.map((range, idx) => (
                      <Badge key={idx} variant="outline">
                        {range}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Next Steps */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Next Steps
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Create an ICP profile based on this recommendation</li>
                <li>Score your existing accounts against this ICP</li>
                <li>Build targeted campaign lists for high-fit accounts</li>
                <li>Monitor performance and refine your ICP over time</li>
              </ol>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleCreateICP} disabled={creating}>
            {creating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Target className="h-4 w-4 mr-2" />
                Create ICP from Recommendation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}