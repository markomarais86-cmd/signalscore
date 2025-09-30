// Mock data for demo mode

export const DEMO_ACCOUNTS = [
  {
    id: 'demo-1',
    external_id: 'DEMO_ACC001',
    org_id: 'demo-org',
    name: 'TechCorp Solutions',
    domain: 'techcorp.com',
    industry_raw: 'Software Development',
    industry_norm: 'Technology',
    employee_count: 250,
    revenue_range: '$10M-$50M',
    country: 'United States',
    updated_at: new Date().toISOString(),
    score: {
      overall: 92,
      fit: 88,
      intent: 95,
      reachability: 90
    },
    contacts: [
      {
        id: 'demo-c1',
        first_name: 'Sarah',
        last_name: 'Chen',
        email: 'sarah.chen@techcorp.com',
        title_raw: 'Chief Technology Officer'
      }
    ]
  },
  {
    id: 'demo-2',
    external_id: 'DEMO_ACC002',
    org_id: 'demo-org',
    name: 'DataFlow Industries',
    domain: 'dataflow.io',
    industry_raw: 'Data Analytics',
    industry_norm: 'Technology',
    employee_count: 180,
    revenue_range: '$5M-$10M',
    country: 'Canada',
    updated_at: new Date().toISOString(),
    score: {
      overall: 85,
      fit: 82,
      intent: 88,
      reachability: 85
    },
    contacts: [
      {
        id: 'demo-c2',
        first_name: 'Emma',
        last_name: 'Thompson',
        email: 'emma.thompson@dataflow.io',
        title_raw: 'Head of Data Science'
      }
    ]
  },
  {
    id: 'demo-3',
    external_id: 'DEMO_ACC003',
    org_id: 'demo-org',
    name: 'CloudScale Systems',
    domain: 'cloudscale.net',
    industry_raw: 'Cloud Services',
    industry_norm: 'Technology',
    employee_count: 450,
    revenue_range: '$50M-$100M',
    country: 'United Kingdom',
    updated_at: new Date().toISOString(),
    score: {
      overall: 89,
      fit: 90,
      intent: 85,
      reachability: 92
    },
    contacts: [
      {
        id: 'demo-c3',
        first_name: 'James',
        last_name: 'Wilson',
        email: 'james.wilson@cloudscale.net',
        title_raw: 'Chief Information Officer'
      }
    ]
  },
  {
    id: 'demo-4',
    external_id: 'DEMO_ACC004',
    org_id: 'demo-org',
    name: 'FinTech Innovations',
    domain: 'fintech-inn.com',
    industry_raw: 'Financial Technology',
    industry_norm: 'Financial Services',
    employee_count: 320,
    revenue_range: '$25M-$50M',
    country: 'Germany',
    updated_at: new Date().toISOString(),
    score: {
      overall: 78,
      fit: 80,
      intent: 75,
      reachability: 80
    },
    contacts: []
  },
  {
    id: 'demo-5',
    external_id: 'DEMO_ACC005',
    org_id: 'demo-org',
    name: 'RetailMax Group',
    domain: 'retailmax.com',
    industry_raw: 'E-commerce',
    industry_norm: 'Retail',
    employee_count: 1200,
    revenue_range: '$100M-$500M',
    country: 'United States',
    updated_at: new Date().toISOString(),
    score: {
      overall: 45,
      fit: 40,
      intent: 50,
      reachability: 45
    },
    contacts: []
  }
];

export const DEMO_LEADS = [
  {
    id: 'demo-l1',
    external_id: 'DEMO_LEAD001',
    org_id: 'demo-org',
    name: 'TechCorp Solutions - Enterprise Deal',
    status: 'qualified',
    created_at: new Date().toISOString()
  },
  {
    id: 'demo-l2',
    external_id: 'DEMO_LEAD002',
    org_id: 'demo-org',
    name: 'DataFlow Industries - Analytics Platform',
    status: 'open',
    created_at: new Date().toISOString()
  },
  {
    id: 'demo-l3',
    external_id: 'DEMO_LEAD003',
    org_id: 'demo-org',
    name: 'CloudScale Systems - Infrastructure Upgrade',
    status: 'qualified',
    created_at: new Date().toISOString()
  }
];

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
