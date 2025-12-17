import { useState } from 'react';
import { ICPProfile } from '@/types/icp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LaunchPulseDiscovery } from '@/components/discovery/LaunchPulseDiscovery';
import { 
  Building, 
  Users, 
  MapPin, 
  Target, 
  Rocket, 
  BarChart3, 
  Edit,
  ArrowLeft,
  Briefcase,
  DollarSign
} from 'lucide-react';

interface ICPDetailViewProps {
  icp: ICPProfile;
  onBack: () => void;
  onEdit: (icp: ICPProfile) => void;
  defaultTab?: string;
}

export function ICPDetailView({ icp, onBack, onEdit, defaultTab = 'overview' }: ICPDetailViewProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to ICPs
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{icp.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{icp.status || 'draft'}</Badge>
              {icp.confidence_score && (
                <Badge variant="outline">{icp.confidence_score}% confidence</Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => onEdit(icp)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit ICP
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Matched Accounts
          </TabsTrigger>
          <TabsTrigger value="discover" className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Discover New
          </TabsTrigger>
          <TabsTrigger value="tam" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            TAM Analysis
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Description */}
            {icp.description && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{icp.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Industries */}
            {icp.industries && icp.industries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Target Industries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.industries.map((industry, i) => (
                      <Badge key={i} variant="secondary">{industry}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Geographies */}
            {icp.geographies && icp.geographies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Target Geographies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.geographies.map((geo, i) => (
                      <Badge key={i} variant="secondary">{geo}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Company Sizes */}
            {icp.company_sizes && icp.company_sizes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Company Sizes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.company_sizes.map((size, i) => (
                      <Badge key={i} variant="secondary">{size}+ employees</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Revenue Ranges */}
            {icp.revenue_ranges && icp.revenue_ranges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Revenue Ranges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.revenue_ranges.map((range, i) => (
                      <Badge key={i} variant="secondary">{range}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Job Titles */}
            {icp.persona_job_titles && icp.persona_job_titles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Target Personas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.persona_job_titles.map((title, i) => (
                      <Badge key={i} variant="secondary">{title}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tech Stack */}
            {icp.tech_stack && icp.tech_stack.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tech Stack</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {icp.tech_stack.map((tech, i) => (
                      <Badge key={i} variant="outline">{tech}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Matched Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle>Matched Accounts</CardTitle>
              <CardDescription>
                Accounts in your database that match this ICP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Building className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Account matching coming soon</p>
                <p className="text-sm">View matched accounts in the Accounts page with ICP filter</p>
                <Button variant="outline" className="mt-4" asChild>
                  <a href={`/accounts?icp_id=${icp.id}`}>View in Accounts</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Discover Tab */}
        <TabsContent value="discover">
          <LaunchPulseDiscovery icp={icp} compact />
        </TabsContent>

        {/* TAM Analysis Tab */}
        <TabsContent value="tam">
          <Card>
            <CardHeader>
              <CardTitle>TAM Analysis</CardTitle>
              <CardDescription>
                Total Addressable Market analysis for this ICP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">TAM Analysis</p>
                <p className="text-sm">
                  {icp.tam_estimate 
                    ? `Estimated TAM: ${icp.tam_estimate.toLocaleString()} companies`
                    : 'Run discovery to estimate TAM'}
                </p>
                {icp.match_count && (
                  <p className="text-sm mt-2">
                    Current matches: {icp.match_count.toLocaleString()} accounts
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
