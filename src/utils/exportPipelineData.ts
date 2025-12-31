import type { PipelineMetrics } from '@/hooks/use-pipeline-analytics';

export function exportPipelineDataToCSV(metrics: PipelineMetrics | undefined): void {
  if (!metrics) {
    console.warn('No pipeline data to export');
    return;
  }

  const rows: string[][] = [];

  // Summary section
  rows.push(['Pipeline Analytics Export']);
  rows.push([`Period: ${metrics.periodStart} to ${metrics.periodEnd}`]);
  rows.push([]);
  
  // Key Metrics
  rows.push(['Key Metrics']);
  rows.push(['Metric', 'Value']);
  rows.push(['Total Pipeline Value', `$${metrics.totalPipelineValue.toLocaleString()}`]);
  rows.push(['Total Open Deals', metrics.totalOpenDeals.toString()]);
  rows.push(['Average Deal Size', `$${metrics.avgDealSize.toLocaleString()}`]);
  rows.push(['Win Rate', `${(metrics.winRate * 100).toFixed(1)}%`]);
  rows.push(['Avg Sales Cycle (Days)', metrics.avgSalesCycleDays.toString()]);
  rows.push(['Sales Velocity', `$${metrics.salesVelocity.toLocaleString()}/day`]);
  rows.push(['Won Deals', `${metrics.wonDealsCount} ($${metrics.wonDealsValue.toLocaleString()})`]);
  rows.push(['Lost Deals', `${metrics.lostDealsCount} ($${metrics.lostDealsValue.toLocaleString()})`]);
  rows.push([]);

  // Stage Breakdown
  rows.push(['Stage Breakdown']);
  rows.push(['Stage', 'Count', 'Value', 'Conversion Rate', 'Avg Duration (Days)']);
  metrics.stages.forEach(stage => {
    rows.push([
      stage.stage,
      stage.count.toString(),
      `$${stage.value.toLocaleString()}`,
      `${(stage.conversionRate * 100).toFixed(1)}%`,
      stage.avgDurationDays.toFixed(1)
    ]);
  });
  rows.push([]);

  // Deals at Risk
  if (metrics.dealsAtRisk.length > 0) {
    rows.push(['Deals at Risk']);
    rows.push(['Deal Name', 'Account', 'Amount', 'Stage', 'Days in Stage', 'Days Overdue']);
    metrics.dealsAtRisk.forEach(deal => {
      rows.push([
        deal.name,
        deal.accountName || 'N/A',
        `$${deal.amount.toLocaleString()}`,
        deal.stage,
        deal.daysInStage.toString(),
        deal.daysOverdue.toString()
      ]);
    });
    rows.push([]);
  }

  // Loss Reasons
  if (metrics.lossReasons.length > 0) {
    rows.push(['Loss Reasons']);
    rows.push(['Reason', 'Count', 'Value', 'Percentage']);
    metrics.lossReasons.forEach(reason => {
      rows.push([
        reason.reason,
        reason.count.toString(),
        `$${reason.value.toLocaleString()}`,
        `${reason.percentage.toFixed(1)}%`
      ]);
    });
  }

  // Convert to CSV string
  const csvContent = rows.map(row => 
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `pipeline-analytics-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
