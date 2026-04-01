// Realistic demo data generator to replace hardcoded mockData.ts

const INDUSTRIES = [
  { norm: 'Technology', raw: ['Software Development', 'Cloud Services', 'Data Analytics', 'Cybersecurity', 'AI/ML Platforms', 'DevOps Tools'] },
  { norm: 'Financial Services', raw: ['Financial Technology', 'Banking Software', 'InsurTech', 'Payment Processing', 'Wealth Management'] },
  { norm: 'Healthcare', raw: ['HealthTech', 'Medical Devices', 'Digital Health', 'Telemedicine', 'Clinical Software'] },
  { norm: 'Manufacturing', raw: ['Industrial IoT', 'Supply Chain Tech', 'Robotics', 'Smart Manufacturing'] },
  { norm: 'Retail', raw: ['E-commerce', 'Retail Analytics', 'POS Systems', 'Digital Commerce'] },
  { norm: 'Media', raw: ['AdTech', 'Content Platforms', 'Digital Media', 'Streaming Services'] },
];

const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Australia', 'Netherlands', 'Singapore', 'Japan', 'Brazil'];
const CITIES: Record<string, string[]> = {
  'United States': ['San Francisco', 'New York', 'Austin', 'Seattle', 'Boston', 'Chicago', 'Denver', 'Miami'],
  'Canada': ['Toronto', 'Vancouver', 'Montreal'],
  'United Kingdom': ['London', 'Manchester', 'Edinburgh'],
  'Germany': ['Berlin', 'Munich', 'Hamburg', 'Frankfurt'],
  'France': ['Paris', 'Lyon', 'Marseille'],
  'Australia': ['Sydney', 'Melbourne'],
  'Netherlands': ['Amsterdam', 'Rotterdam'],
  'Singapore': ['Singapore'],
  'Japan': ['Tokyo', 'Osaka'],
  'Brazil': ['São Paulo', 'Rio de Janeiro'],
};

const REVENUE_RANGES = ['$1M-$5M', '$5M-$10M', '$10M-$50M', '$50M-$100M', '$100M-$500M', '$500M-$1B'];
const COMPANY_PREFIXES = ['Apex', 'Vertex', 'Nova', 'Quantum', 'Synth', 'Pulse', 'Orbit', 'Flux', 'Core', 'Nimbus', 'Stratos', 'Cipher', 'Helix', 'Prism', 'Zeta', 'Vantage', 'Catalyst', 'Pinnacle', 'Summit', 'Horizon'];
const COMPANY_SUFFIXES = ['Systems', 'Labs', 'Technologies', 'Solutions', 'Group', 'Digital', 'AI', 'Analytics', 'Platform', 'Networks', 'Cloud', 'Software', 'Intelligence', 'Data', 'Dynamics'];

const TITLES_BY_DEPT: Record<string, string[]> = {
  Engineering: ['CTO', 'VP of Engineering', 'Director of Engineering', 'Head of Platform', 'Principal Engineer'],
  Sales: ['CRO', 'VP of Sales', 'Head of Revenue', 'Director of Sales', 'Sales Director'],
  Marketing: ['CMO', 'VP of Marketing', 'Head of Growth', 'Director of Demand Gen', 'Head of Digital'],
  Product: ['CPO', 'VP of Product', 'Head of Product', 'Director of Product', 'Product Lead'],
  IT: ['CIO', 'VP of IT', 'Director of IT', 'Head of Infrastructure', 'IT Director'],
  'Data Science': ['Chief Data Officer', 'Head of Data Science', 'VP of Analytics', 'Director of Data'],
};

const FIRST_NAMES = ['James', 'Sarah', 'Michael', 'Emma', 'David', 'Lisa', 'Robert', 'Anna', 'William', 'Maria', 'Thomas', 'Jennifer', 'Daniel', 'Jessica', 'Christopher', 'Amanda', 'Matthew', 'Olivia', 'Andrew', 'Emily', 'Alexander', 'Sophia', 'Nathan', 'Rachel', 'Benjamin', 'Laura', 'Samuel', 'Katherine', 'Patrick', 'Victoria'];
const LAST_NAMES = ['Chen', 'Wilson', 'Thompson', 'Martinez', 'Anderson', 'Taylor', 'Brown', 'Garcia', 'Lee', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'King', 'Wright', 'Scott', 'Adams', 'Baker', 'Patel', 'Singh', 'Kim', 'Tanaka', 'Mueller', 'Johansson', 'Nguyen', 'Costa', 'Dubois', 'Schmidt'];

const TECH_STACKS = ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker', 'React', 'Node.js', 'Python', 'Terraform', 'Snowflake', 'Databricks', 'Salesforce', 'HubSpot', 'Slack', 'Jira', 'Confluence', 'GitHub', 'DataDog', 'Splunk', 'Okta'];

const DEAL_STAGES = ['Discovery', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
const LOSS_REASONS = ['Price too high', 'Chose competitor', 'No budget', 'Timing not right', 'Feature gap', 'Internal restructuring'];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rand: () => number): T[] {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, n);
}

function generateDomain(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
}

export interface DemoAccount {
  id: string;
  external_id: string;
  org_id: string;
  name: string;
  domain: string;
  industry_raw: string;
  industry_norm: string;
  employee_count: number;
  revenue_range: string;
  country: string;
  city: string;
  tech_stack: string[];
  founded_year: number;
  updated_at: string;
  score: { overall: number; fit: number; intent: number; reachability: number };
  contacts: DemoContact[];
}

export interface DemoContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  title_raw: string;
  department: string;
  seniority: string;
  linkedin_url: string;
}

export interface DemoDeal {
  id: string;
  account_id: string;
  account_name: string;
  name: string;
  stage: string;
  amount: number;
  created_at: string;
  close_date: string;
  owner_name: string;
  loss_reason?: string;
}

export function generateDemoData(seed: number = 42, accountCount: number = 60) {
  const rand = seededRandom(seed);

  const accounts: DemoAccount[] = [];
  const deals: DemoDeal[] = [];

  for (let i = 0; i < accountCount; i++) {
    const industry = pick(INDUSTRIES, rand);
    const industryRaw = pick(industry.raw, rand);
    const country = pick(COUNTRIES, rand);
    const city = pick(CITIES[country] || ['Unknown'], rand);
    const prefix = pick(COMPANY_PREFIXES, rand);
    const suffix = pick(COMPANY_SUFFIXES, rand);
    const name = `${prefix} ${suffix}`;
    const employeeCount = Math.round((rand() * 4500 + 50) / 10) * 10;

    // Generate realistic score distribution (bell curve centered around 60)
    const fitBase = Math.round(rand() * 40 + rand() * 40 + 10);
    const intentBase = Math.round(rand() * 40 + rand() * 40 + 10);
    const reachBase = Math.round(rand() * 30 + rand() * 30 + 30);
    const fit = Math.min(100, Math.max(5, fitBase));
    const intent = Math.min(100, Math.max(5, intentBase));
    const reachability = Math.min(100, Math.max(10, reachBase));
    const overall = Math.round(fit * 0.4 + intent * 0.35 + reachability * 0.25);

    // Generate 1-4 contacts per account
    const contactCount = Math.floor(rand() * 4) + 1;
    const depts = pickN(Object.keys(TITLES_BY_DEPT), contactCount, rand);
    const contacts: DemoContact[] = depts.map((dept, ci) => {
      const firstName = pick(FIRST_NAMES, rand);
      const lastName = pick(LAST_NAMES, rand);
      const title = pick(TITLES_BY_DEPT[dept], rand);
      const seniority = title.startsWith('C') || title.startsWith('Chief') ? 'C-Level' : title.includes('VP') ? 'VP' : 'Director';
      return {
        id: `demo-c-${i}-${ci}`,
        first_name: firstName,
        last_name: lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${generateDomain(name)}`,
        title_raw: title,
        department: dept,
        seniority,
        linkedin_url: `https://linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
      };
    });

    const revenueIdx = Math.min(REVENUE_RANGES.length - 1, Math.floor((employeeCount / 5000) * REVENUE_RANGES.length));

    accounts.push({
      id: `demo-${i + 1}`,
      external_id: `DEMO_ACC${String(i + 1).padStart(3, '0')}`,
      org_id: 'demo-org',
      name,
      domain: generateDomain(name),
      industry_raw: industryRaw,
      industry_norm: industry.norm,
      employee_count: employeeCount,
      revenue_range: REVENUE_RANGES[revenueIdx],
      country,
      city,
      tech_stack: pickN(TECH_STACKS, Math.floor(rand() * 6) + 2, rand),
      founded_year: Math.floor(rand() * 25) + 2000,
      updated_at: new Date(Date.now() - Math.floor(rand() * 30) * 86400000).toISOString(),
      score: { overall, fit, intent, reachability },
      contacts,
    });

    // 40% of accounts have deals
    if (rand() < 0.4) {
      const stage = pick(DEAL_STAGES, rand);
      const amount = Math.round((rand() * 200000 + 10000) / 1000) * 1000;
      const daysAgo = Math.floor(rand() * 180);
      deals.push({
        id: `demo-d-${i}`,
        account_id: `demo-${i + 1}`,
        account_name: name,
        name: `${name} - ${pick(['Enterprise License', 'Platform Deal', 'Annual Contract', 'Expansion', 'Pilot Program'], rand)}`,
        stage,
        amount,
        created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
        close_date: new Date(Date.now() + (90 - daysAgo) * 86400000).toISOString(),
        owner_name: `${pick(FIRST_NAMES, rand)} ${pick(LAST_NAMES, rand)}`,
        loss_reason: stage === 'Closed Lost' ? pick(LOSS_REASONS, rand) : undefined,
      });
    }
  }

  // Summary stats
  const totalPipelineValue = deals.filter(d => !d.stage.includes('Closed')).reduce((sum, d) => sum + d.amount, 0);
  const wonDeals = deals.filter(d => d.stage === 'Closed Won');
  const lostDeals = deals.filter(d => d.stage === 'Closed Lost');
  const avgScore = Math.round(accounts.reduce((s, a) => s + a.score.overall, 0) / accounts.length);
  const highFit = accounts.filter(a => a.score.overall >= 75).length;

  return {
    accounts,
    deals,
    summary: {
      totalAccounts: accounts.length,
      totalContacts: accounts.reduce((s, a) => s + a.contacts.length, 0),
      totalDeals: deals.length,
      totalPipelineValue,
      wonDeals: wonDeals.length,
      wonValue: wonDeals.reduce((s, d) => s + d.amount, 0),
      lostDeals: lostDeals.length,
      avgScore,
      highFitAccounts: highFit,
      industries: [...new Set(accounts.map(a => a.industry_norm))],
      countries: [...new Set(accounts.map(a => a.country))],
    },
  };
}

export const DEMO_ICP_PROFILES = [
  {
    id: 'demo-icp-1',
    org_id: 'demo-org',
    name: 'Enterprise Technology Companies',
    description: 'Mid-to-large technology companies with strong digital transformation initiatives',
    industries: ['Technology', 'Software Development', 'Data Analytics', 'Cloud Services'],
    sub_industries: ['SaaS', 'Enterprise Software', 'Cloud Infrastructure', 'AI/ML Platforms'],
    company_sizes: [200, 500, 1000],
    revenue_ranges: ['$10M-$50M', '$50M-$100M', '$100M-$500M'],
    geographies: ['United States', 'Canada', 'United Kingdom', 'Germany'],
    persona_job_titles: ['Chief Technology Officer', 'VP of Engineering', 'Head of Data Science', 'Chief Information Officer'],
    persona_seniority_levels: ['C-Level', 'VP', 'Director'],
    persona_departments: ['Engineering', 'IT', 'Data Science', 'Product'],
    status: 'active' as const,
    confidence_score: 85,
    tam_estimate: 45000000,
    match_count: 6,
    created_at: new Date().toISOString(),
    tags: ['Enterprise', 'Technology', 'B2B']
  }
];
