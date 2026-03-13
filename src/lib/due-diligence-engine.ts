// Due Diligence assessment engine — pure client-side analysis of CSV data
// No database writes, fully read-only

export interface CrmRecord {
  [key: string]: string;
}

export interface DueDiligenceReport {
  companyName: string;
  recordCount: number;
  generatedAt: string;

  // Data Quality
  dataQuality: {
    score: number; // 0-100
    grade: "A" | "B" | "C" | "D" | "F";
    totalFields: number;
    populatedFieldAvg: number; // avg % of fields filled per record
    emailCoverage: number;
    phoneCoverage: number;
    domainCoverage: number;
    industryCoverage: number;
    revenueCoverage: number;
    employeeCoverage: number;
    missingCriticalFields: string[];
  };

  // ICP Fit Analysis
  icpAnalysis: {
    industryDistribution: { name: string; count: number; pct: number }[];
    sizeDistribution: { band: string; count: number; pct: number }[];
    geoDistribution: { name: string; count: number; pct: number }[];
    concentrationRisk: number; // 0-100, higher = more concentrated
    topIndustry: string;
    topGeo: string;
  };

  // TAM Sizing
  tamEstimate: {
    totalAccounts: number;
    uniqueDomains: number;
    estimatedTAM: string;
    avgDealSize: number | null;
    revenueSegments: { range: string; count: number; pct: number }[];
  };

  // Pipeline Quality
  pipelineQuality: {
    score: number;
    totalDeals: number;
    avgDealAge: number | null;
    stageDistribution: { stage: string; count: number; pct: number }[];
    closedWonCount: number;
    closedWonPct: number;
    avgWinRate: number | null;
    staleDealsPct: number;
  };

  // Overall Assessment
  overallScore: number;
  overallGrade: "A" | "B" | "C" | "D" | "F";
  findings: { type: "positive" | "warning" | "critical"; text: string }[];
}

function findColumn(headers: string[], ...candidates: string[]): string | null {
  const lowerHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const c of candidates) {
    const target = c.toLowerCase().replace(/[^a-z0-9]/g, "");
    const idx = lowerHeaders.findIndex((h) => h.includes(target));
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function getCoverage(records: CrmRecord[], col: string | null): number {
  if (!col || records.length === 0) return 0;
  const filled = records.filter((r) => r[col]?.trim()).length;
  return Math.round((filled / records.length) * 100);
}

function getDistribution(records: CrmRecord[], col: string | null, limit = 10): { name: string; count: number; pct: number }[] {
  if (!col) return [];
  const counts: Record<string, number> = {};
  records.forEach((r) => {
    const val = r[col]?.trim();
    if (val) counts[val] = (counts[val] || 0) + 1;
  });
  const total = records.length;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
}

function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function parseSizeBand(val: string | undefined): string {
  if (!val) return "Unknown";
  const num = parseInt(val.replace(/[^0-9]/g, ""), 10);
  if (isNaN(num)) return val.trim() || "Unknown";
  if (num <= 10) return "1-10";
  if (num <= 50) return "11-50";
  if (num <= 200) return "51-200";
  if (num <= 1000) return "201-1000";
  if (num <= 5000) return "1001-5000";
  return "5000+";
}

function parseRevenueBand(val: string | undefined): string {
  if (!val) return "Unknown";
  const cleaned = val.replace(/[$,]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return val.trim() || "Unknown";
  if (num < 1_000_000) return "<$1M";
  if (num < 10_000_000) return "$1M-$10M";
  if (num < 50_000_000) return "$10M-$50M";
  if (num < 100_000_000) return "$50M-$100M";
  if (num < 500_000_000) return "$100M-$500M";
  return "$500M+";
}

export function parseCSV(text: string): { headers: string[]; records: CrmRecord[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], records: [] };

  // Simple CSV parser handling quoted fields
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const records = lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const record: CrmRecord = {};
    headers.forEach((h, i) => {
      record[h] = vals[i] ?? "";
    });
    return record;
  });

  return { headers, records };
}

export function analyzeCrmExport(headers: string[], records: CrmRecord[], companyName: string): DueDiligenceReport {
  // Column detection
  const emailCol = findColumn(headers, "email", "emailaddress", "email_address", "contact_email");
  const phoneCol = findColumn(headers, "phone", "phonenumber", "phone_number", "mobile");
  const domainCol = findColumn(headers, "domain", "website", "company_domain", "url");
  const industryCol = findColumn(headers, "industry", "industry_norm", "industry_raw", "sector");
  const revenueCol = findColumn(headers, "revenue", "annual_revenue", "revenue_range", "arr");
  const employeeCol = findColumn(headers, "employees", "employee_count", "employeecount", "company_size", "size");
  const geoCol = findColumn(headers, "country", "geography", "region", "state", "location", "hq_country");
  const stageCol = findColumn(headers, "stage", "deal_stage", "pipeline_stage", "opportunity_stage", "status");
  const dealAmountCol = findColumn(headers, "amount", "deal_amount", "value", "deal_value", "opportunity_amount");
  const closeDateCol = findColumn(headers, "close_date", "closed_date", "expected_close", "close_by");
  const nameCol = findColumn(headers, "company", "account_name", "company_name", "name", "account");
  const createdCol = findColumn(headers, "created_at", "created_date", "create_date", "date_created");

  // Data Quality
  const criticalFields = [
    { name: "Email", col: emailCol },
    { name: "Domain/Website", col: domainCol },
    { name: "Industry", col: industryCol },
    { name: "Employee Count", col: employeeCol },
    { name: "Revenue", col: revenueCol },
    { name: "Geography", col: geoCol },
  ];
  const missingCritical = criticalFields.filter((f) => !f.col).map((f) => f.name);

  const fieldCoverages = headers.map((h) => getCoverage(records, h));
  const populatedFieldAvg = fieldCoverages.length > 0
    ? Math.round(fieldCoverages.reduce((a, b) => a + b, 0) / fieldCoverages.length)
    : 0;

  const emailCov = getCoverage(records, emailCol);
  const phoneCov = getCoverage(records, phoneCol);
  const domainCov = getCoverage(records, domainCol);
  const industryCov = getCoverage(records, industryCol);
  const revenueCov = getCoverage(records, revenueCol);
  const employeeCov = getCoverage(records, employeeCol);

  const dqScore = Math.round(
    (emailCov * 0.2 + domainCov * 0.15 + industryCov * 0.2 + employeeCov * 0.15 + revenueCov * 0.15 + populatedFieldAvg * 0.15)
  );

  // ICP Analysis
  const industryDist = getDistribution(records, industryCol);
  const geoDist = getDistribution(records, geoCol);

  const sizeGroups: Record<string, number> = {};
  records.forEach((r) => {
    const band = parseSizeBand(r[employeeCol!]);
    sizeGroups[band] = (sizeGroups[band] || 0) + 1;
  });
  const sizeDist = Object.entries(sizeGroups)
    .map(([band, count]) => ({ band, count, pct: Math.round((count / records.length) * 100) }))
    .sort((a, b) => b.count - a.count);

  const concentrationRisk = industryDist.length > 0
    ? Math.round(industryDist[0].pct)
    : 0;

  // TAM Estimate
  const uniqueDomains = new Set(
    records.map((r) => (domainCol ? r[domainCol]?.trim().toLowerCase() : "")).filter(Boolean)
  ).size;

  const dealAmounts = records
    .map((r) => (dealAmountCol ? parseFloat(r[dealAmountCol]?.replace(/[$,]/g, "") || "0") : 0))
    .filter((v) => v > 0);
  const avgDealSize = dealAmounts.length > 0
    ? Math.round(dealAmounts.reduce((a, b) => a + b, 0) / dealAmounts.length)
    : null;

  const revenueGroups: Record<string, number> = {};
  records.forEach((r) => {
    const band = parseRevenueBand(r[revenueCol!]);
    revenueGroups[band] = (revenueGroups[band] || 0) + 1;
  });
  const revenueSegments = Object.entries(revenueGroups)
    .map(([range, count]) => ({ range, count, pct: Math.round((count / records.length) * 100) }))
    .sort((a, b) => b.count - a.count);

  const estimatedTAM = avgDealSize
    ? `$${((uniqueDomains || records.length) * avgDealSize / 1_000_000).toFixed(1)}M`
    : "Insufficient data";

  // Pipeline Quality
  const stageDist = getDistribution(records, stageCol);
  const closedWonVariants = ["closed won", "closedwon", "closed-won", "won", "closed/won"];
  const closedWonCount = stageCol
    ? records.filter((r) => closedWonVariants.includes(r[stageCol]?.toLowerCase().trim())).length
    : 0;
  const closedLostVariants = ["closed lost", "closedlost", "closed-lost", "lost", "closed/lost"];
  const closedLostCount = stageCol
    ? records.filter((r) => closedLostVariants.includes(r[stageCol]?.toLowerCase().trim())).length
    : 0;
  const closedTotal = closedWonCount + closedLostCount;
  const winRate = closedTotal > 0 ? Math.round((closedWonCount / closedTotal) * 100) : null;

  // Stale deals: created > 90 days ago and not closed
  let stalePct = 0;
  if (createdCol && stageCol) {
    const now = Date.now();
    const openDeals = records.filter((r) => {
      const stage = r[stageCol]?.toLowerCase().trim();
      return !closedWonVariants.includes(stage) && !closedLostVariants.includes(stage);
    });
    const stale = openDeals.filter((r) => {
      const d = new Date(r[createdCol]).getTime();
      return !isNaN(d) && (now - d) > 90 * 86400000;
    });
    stalePct = openDeals.length > 0 ? Math.round((stale.length / openDeals.length) * 100) : 0;
  }

  const pipelineScore = stageCol
    ? Math.round(
        (winRate ?? 30) * 0.3 +
        (100 - stalePct) * 0.3 +
        (stageDist.length > 2 ? 20 : 10) +
        (closedWonCount > 5 ? 20 : closedWonCount > 0 ? 10 : 0)
      )
    : 0;

  // Overall
  const overallScore = Math.round(dqScore * 0.4 + (stageCol ? pipelineScore * 0.3 : 0) + (100 - missingCritical.length * 12) * (stageCol ? 0.3 : 0.6));
  const clampedScore = Math.max(0, Math.min(100, overallScore));

  // Findings
  const findings: DueDiligenceReport["findings"] = [];
  if (dqScore >= 70) findings.push({ type: "positive", text: `Data quality score is strong at ${dqScore}%` });
  if (emailCov >= 80) findings.push({ type: "positive", text: `${emailCov}% email coverage — strong contact data` });
  if (concentrationRisk > 60) findings.push({ type: "warning", text: `High industry concentration: ${industryDist[0]?.name} at ${concentrationRisk}%` });
  if (missingCritical.length > 2) findings.push({ type: "critical", text: `Missing critical fields: ${missingCritical.join(", ")}` });
  if (emailCov < 50) findings.push({ type: "critical", text: `Low email coverage (${emailCov}%) — contact data gaps` });
  if (stalePct > 40) findings.push({ type: "warning", text: `${stalePct}% of open deals are stale (>90 days)` });
  if (winRate !== null && winRate < 20) findings.push({ type: "critical", text: `Low win rate at ${winRate}%` });
  if (winRate !== null && winRate >= 30) findings.push({ type: "positive", text: `Healthy win rate at ${winRate}%` });
  if (uniqueDomains > 100) findings.push({ type: "positive", text: `${uniqueDomains} unique domains — good market coverage` });
  if (records.length < 50) findings.push({ type: "warning", text: `Small dataset (${records.length} records) — assessment confidence is limited` });
  if (revenueCov < 30) findings.push({ type: "warning", text: `Revenue data coverage is low (${revenueCov}%) — TAM estimate may be unreliable` });

  return {
    companyName,
    recordCount: records.length,
    generatedAt: new Date().toISOString(),
    dataQuality: {
      score: dqScore,
      grade: gradeFromScore(dqScore),
      totalFields: headers.length,
      populatedFieldAvg,
      emailCoverage: emailCov,
      phoneCoverage: phoneCov,
      domainCoverage: domainCov,
      industryCoverage: industryCov,
      revenueCoverage: revenueCov,
      employeeCoverage: employeeCov,
      missingCriticalFields: missingCritical,
    },
    icpAnalysis: {
      industryDistribution: industryDist,
      sizeDistribution: sizeDist,
      geoDistribution: geoDist,
      concentrationRisk,
      topIndustry: industryDist[0]?.name ?? "N/A",
      topGeo: geoDist[0]?.name ?? "N/A",
    },
    tamEstimate: {
      totalAccounts: records.length,
      uniqueDomains,
      estimatedTAM,
      avgDealSize,
      revenueSegments,
    },
    pipelineQuality: {
      score: pipelineScore,
      totalDeals: stageCol ? records.length : 0,
      avgDealAge: null,
      stageDistribution: stageDist.map(d => ({ stage: d.name, count: d.count, pct: d.pct })),
      closedWonCount,
      closedWonPct: records.length > 0 ? Math.round((closedWonCount / records.length) * 100) : 0,
      avgWinRate: winRate,
      staleDealsPct: stalePct,
    },
    overallScore: clampedScore,
    overallGrade: gradeFromScore(clampedScore),
    findings,
  };
}
