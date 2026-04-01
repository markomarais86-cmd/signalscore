import { Globe, MapPin, Activity } from "lucide-react";
import { GrowthCommandKPIs } from "@/components/executive/GrowthCommandKPIs";
import { ICPCoveragePanel } from "@/components/executive/ICPCoveragePanel";
import { ICPProfileSummaryCard } from "@/components/executive/ICPProfileSummaryCard";
import { SimpleICPTable } from "@/components/executive/SimpleICPTable";
import { SimpleTAMCard } from "@/components/executive/SimpleTAMCard";
import { SimpleGeographyCard } from "@/components/executive/SimpleGeographyCard";
import { DataHealthWidget } from "@/components/executive/DataHealthWidget";
import { CollapsibleDashboardCard } from "@/components/executive/CollapsibleDashboardCard";
import { UnifiedInsightsPanel, Insight } from "@/components/executive/UnifiedInsightsPanel";
import type { SourceFilter } from "@/components/executive/SourceFilterToggle";
import type { RiskItem } from "@/utils/risk-detector";

interface DashboardContentProps {
  sourceFilter: SourceFilter;
  // Metrics
  totalAccounts: number;
  totalScores: number;
  highFitAccounts: number;
  medFitAccounts: number;
  lowFitAccounts: number;
  dataCompleteness: number;
  campaignReadyAccounts: number;
  campaignReadyLeads: number;
  averageDealSize: number;
  conversionRate: number;
  // Source-filtered
  crmAccounts: number;
  databaseAccounts: number;
  crmScoredAccounts: number;
  databaseScoredAccounts: number;
  highFitCrmAccounts: number;
  highFitDatabaseAccounts: number;
  medFitCrmAccounts: number;
  medFitDatabaseAccounts: number;
  lowFitCrmAccounts: number;
  lowFitDatabaseAccounts: number;
  // Leads
  totalLeads: number;
  crmLeads: number;
  databaseLeads: number;
  highFitLeads: number;
  medFitLeads: number;
  lowFitLeads: number;
  highFitCrmLeads: number;
  highFitDatabaseLeads: number;
  medFitCrmLeads: number;
  medFitDatabaseLeads: number;
  lowFitCrmLeads: number;
  lowFitDatabaseLeads: number;
  // TAM
  tamData: any;
  geographyDistribution: { country: string; count: number }[];
  icpProfiles: any[];
  // Insights
  risks: RiskItem[];
  insights: Insight[];
  effectiveOrgId: string | undefined;
  onRefreshInsights: () => void;
  // Settings
  onSettingsChange: (v: { averageDealSize: number; conversionRate: number }) => void;
  // Signals
  onLaunchCampaign: (ctx: any) => void;
}

export function DashboardContent(props: DashboardContentProps) {
  const {
    sourceFilter: sf,
    totalAccounts, totalScores, highFitAccounts, medFitAccounts, lowFitAccounts,
    dataCompleteness, campaignReadyAccounts, averageDealSize, conversionRate,
    crmAccounts, databaseAccounts, crmScoredAccounts, databaseScoredAccounts,
    highFitCrmAccounts, highFitDatabaseAccounts, medFitCrmAccounts, medFitDatabaseAccounts,
    lowFitCrmAccounts, lowFitDatabaseAccounts,
    totalLeads, crmLeads, databaseLeads, highFitLeads, medFitLeads, lowFitLeads,
    highFitCrmLeads, highFitDatabaseLeads, medFitCrmLeads, medFitDatabaseLeads,
    lowFitCrmLeads, lowFitDatabaseLeads,
    tamData, geographyDistribution, icpProfiles,
    risks, insights, effectiveOrgId, onRefreshInsights,
    onSettingsChange, onLaunchCampaign,
  } = props;

  const pick = <T,>(crm: T, db: T, all: T) => sf === "database" ? db : sf === "crm" ? crm : all;

  return (
    <>
      <GrowthCommandKPIs
        totalAccounts={sf === "database" ? (tamData?.totalAccounts || 0) : totalAccounts}
        totalScored={pick(crmScoredAccounts, databaseScoredAccounts, totalScores)}
        medFitAccounts={pick(medFitCrmAccounts, medFitDatabaseAccounts, medFitAccounts)}
        dataCompleteness={dataCompleteness}
        highFitAccounts={pick(highFitCrmAccounts, highFitDatabaseAccounts, highFitAccounts)}
        campaignReadyAccounts={campaignReadyAccounts}
        pipelinePotential={campaignReadyAccounts * averageDealSize * 0.25}
        revenueAtRisk={totalAccounts > 0 ? Math.round((totalAccounts - totalScores) * averageDealSize * conversionRate) : 0}
        averageDealSize={averageDealSize}
      />

      <ICPCoveragePanel
        highFitAccounts={pick(highFitCrmAccounts, highFitDatabaseAccounts, highFitAccounts)}
        medFitAccounts={pick(medFitCrmAccounts, medFitDatabaseAccounts, medFitAccounts)}
        lowFitAccounts={pick(lowFitCrmAccounts, lowFitDatabaseAccounts, lowFitAccounts)}
        totalScored={pick(crmScoredAccounts, databaseScoredAccounts, totalScores)}
        highFitLeads={pick(highFitCrmLeads, highFitDatabaseLeads, highFitLeads)}
        medFitLeads={pick(medFitCrmLeads, medFitDatabaseLeads, medFitLeads)}
        lowFitLeads={pick(lowFitCrmLeads, lowFitDatabaseLeads, lowFitLeads)}
        totalLeads={pick(crmLeads, databaseLeads, totalLeads)}
      />

      <ICPProfileSummaryCard icpProfiles={icpProfiles} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <SimpleICPTable
          crmAccounts={crmAccounts}
          databaseAccounts={databaseAccounts}
          highFitCrmAccounts={highFitCrmAccounts}
          highFitDatabaseAccounts={highFitDatabaseAccounts}
          medFitCrmAccounts={medFitCrmAccounts}
          medFitDatabaseAccounts={medFitDatabaseAccounts}
          apolloAccounts={tamData?.totalAccounts}
          apolloHighFitEstimate={
            tamData?.totalAccounts && tamData?.industry_breakdown
              ? Math.round(tamData.totalAccounts * 0.35)
              : undefined
          }
          apolloMedFitEstimate={
            tamData?.totalAccounts && tamData?.industry_breakdown
              ? Math.round(tamData.totalAccounts * 0.25)
              : undefined
          }
        />

        <CollapsibleDashboardCard title="Market Sizing" icon={<Globe className="h-4 w-4 text-primary" />} defaultOpen>
          <SimpleTAMCard
            totalAccounts={sf === "database" ? (tamData?.totalAccounts || 0) : totalAccounts}
            highFitAccounts={pick(highFitCrmAccounts, highFitDatabaseAccounts, highFitAccounts)}
            medFitAccounts={pick(medFitCrmAccounts, medFitDatabaseAccounts, medFitAccounts)}
            campaignReadyAccounts={campaignReadyAccounts}
            averageDealSize={averageDealSize}
            conversionRate={conversionRate}
            onSettingsChange={({ averageDealSize: ds, conversionRate: cr }) => onSettingsChange({ averageDealSize: ds, conversionRate: cr })}
          />
        </CollapsibleDashboardCard>

        <CollapsibleDashboardCard title="Top Geographies" icon={<MapPin className="h-4 w-4 text-primary" />} defaultOpen>
          <SimpleGeographyCard
            geoData={
              sf === "database" && tamData?.geography_breakdown
                ? Object.entries(tamData.geography_breakdown as Record<string, { accounts?: number }>)
                    .map(([country, data]) => ({
                      country,
                      count: typeof data === "object" ? (data.accounts || 0) : typeof data === "number" ? data : 0,
                    }))
                    .sort((a, b) => b.count - a.count)
                : geographyDistribution.map((g) => ({ country: g.country, count: g.count }))
            }
          />
        </CollapsibleDashboardCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <CollapsibleDashboardCard title="Data Health" icon={<Activity className="h-4 w-4 text-primary" />} defaultOpen>
          <DataHealthWidget />
        </CollapsibleDashboardCard>

        <div className="lg:col-span-2">
          <UnifiedInsightsPanel
            risks={risks}
            insights={insights || []}
            orgId={effectiveOrgId}
            onRefresh={onRefreshInsights}
            campaignReadyCount={campaignReadyAccounts}
            completenessScore={dataCompleteness}
            totalScored={totalScores}
          />
        </div>
      </div>
    </>
  );
}
