import { GrowthCommandKPIs } from "@/components/executive/GrowthCommandKPIs";
import { ICPCoveragePanel } from "@/components/executive/ICPCoveragePanel";
import { ICPProfileSummaryCard } from "@/components/executive/ICPProfileSummaryCard";
import { SimpleICPTable } from "@/components/executive/SimpleICPTable";
import { SimpleTAMCard } from "@/components/executive/SimpleTAMCard";
import { SimpleGeographyCard } from "@/components/executive/SimpleGeographyCard";
import { DataHealthWidget } from "@/components/executive/DataHealthWidget";
import { UnifiedInsightsPanel, Insight } from "@/components/executive/UnifiedInsightsPanel";
import type { SourceFilter } from "@/components/executive/SourceFilterToggle";
import type { RiskItem } from "@/utils/risk-detector";

interface DashboardContentProps {
  sourceFilter: SourceFilter;
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
  tamData: any;
  geographyDistribution: { country: string; count: number }[];
  icpProfiles: any[];
  risks: RiskItem[];
  insights: Insight[];
  effectiveOrgId: string | undefined;
  onRefreshInsights: () => void;
  onSettingsChange: (v: { averageDealSize: number; conversionRate: number }) => void;
  onLaunchCampaign: (ctx: any) => void;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.1em] py-2 px-0.5">
      {title}
    </h2>
  );
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
    <div className="space-y-5">
      {/* KPI Row */}
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

      {/* ICP Coverage — widget card */}
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

      {/* 3-column widget grid */}
      <div>
        <SectionHeader title="Market Intelligence" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="widget-card">
            <div className="widget-header">
              <span className="text-xs font-medium text-foreground">ICP by Source</span>
            </div>
            <SimpleICPTable
              crmAccounts={crmAccounts}
              databaseAccounts={databaseAccounts}
              highFitCrmAccounts={highFitCrmAccounts}
              highFitDatabaseAccounts={highFitDatabaseAccounts}
              medFitCrmAccounts={medFitCrmAccounts}
              medFitDatabaseAccounts={medFitDatabaseAccounts}
              apolloAccounts={tamData?.totalAccounts}
              apolloHighFitEstimate={tamData?.totalAccounts && tamData?.industry_breakdown ? Math.round(tamData.totalAccounts * 0.35) : undefined}
              apolloMedFitEstimate={tamData?.totalAccounts && tamData?.industry_breakdown ? Math.round(tamData.totalAccounts * 0.25) : undefined}
            />
          </div>

          <div className="widget-card">
            <div className="widget-header">
              <span className="text-xs font-medium text-foreground">Market Sizing</span>
            </div>
            <SimpleTAMCard
              totalAccounts={sf === "database" ? (tamData?.totalAccounts || 0) : totalAccounts}
              highFitAccounts={pick(highFitCrmAccounts, highFitDatabaseAccounts, highFitAccounts)}
              medFitAccounts={pick(medFitCrmAccounts, medFitDatabaseAccounts, medFitAccounts)}
              campaignReadyAccounts={campaignReadyAccounts}
              averageDealSize={averageDealSize}
              conversionRate={conversionRate}
              onSettingsChange={({ averageDealSize: ds, conversionRate: cr }) => onSettingsChange({ averageDealSize: ds, conversionRate: cr })}
            />
          </div>

          <div className="widget-card">
            <div className="widget-header">
              <span className="text-xs font-medium text-foreground">Top Geographies</span>
            </div>
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
          </div>
        </div>
      </div>

      {/* Data Health + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="widget-card">
          <div className="widget-header">
            <span className="text-xs font-medium text-foreground">Data Health</span>
          </div>
          <DataHealthWidget />
        </div>

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
    </div>
  );
}
