// Enhanced ICP Constants
// Using ZoomInfo Industry Taxonomy as primary source

import { PRIMARY_INDUSTRIES, SUB_INDUSTRIES_MAP } from './zoominfo-industries';

// Export ZoomInfo industries as primary taxonomy
export const INDUSTRIES = PRIMARY_INDUSTRIES;
export const SUB_INDUSTRIES = SUB_INDUSTRIES_MAP;

export const COMPANY_SIZES = [1, 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export const REVENUE_RANGES = [
  "<$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", 
  "$50M-$100M", "$100M-$250M", "$250M-$500M", "$500M-$1B", "$1B+"
];

export const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Germany", "France", 
  "Netherlands", "Switzerland", "Sweden", "Denmark", "Norway", 
  "Finland", "Belgium", "Austria", "Ireland", "Australia", "New Zealand",
  "Japan", "Singapore", "South Korea", "Hong Kong", "Taiwan",
  "Brazil", "Mexico", "Argentina", "Chile", "Colombia",
  "India", "China", "Israel", "United Arab Emirates", "South Africa",
  "Italy", "Spain", "Portugal", "Poland", "Czech Republic"
];

export const REGIONS = {
  "North America": ["United States", "Canada", "Mexico"],
  "Europe": ["United Kingdom", "Germany", "France", "Netherlands", "Switzerland", "Sweden", "Denmark", "Norway"],
  "Asia Pacific": ["Japan", "Singapore", "South Korea", "Australia", "New Zealand", "Hong Kong", "Taiwan"],
  "Latin America": ["Brazil", "Argentina", "Chile", "Colombia", "Mexico"],
  "Middle East & Africa": ["United Arab Emirates", "Israel", "South Africa"]
};

export const PERSONA_JOB_TITLES = [
  // C-Suite
  "CEO", "CTO", "CFO", "COO", "CMO", "CISO", "CDO", "Chief Digital Officer",
  "Chief Innovation Officer", "Chief Revenue Officer", "Chief Data Officer",
  
  // VP Level
  "VP Engineering", "VP Technology", "VP Operations", "VP Sales", "VP Marketing",
  "VP Finance", "VP Product", "VP Security", "VP Data", "VP Customer Success",
  
  // Directors
  "Director of IT", "Director of Security", "Director of Operations",
  "Director of Product", "Director of Engineering", "Director of Sales",
  "Director of Marketing", "Director of Finance", "Director of Data",
  
  // Heads
  "Head of IT", "Head of Security", "Head of Operations", "Head of Product",
  "Head of Engineering", "Head of Sales", "Head of Marketing", "Head of Data",
  
  // Managers
  "IT Manager", "Security Manager", "Operations Manager", "Product Manager",
  "Engineering Manager", "Sales Manager", "Marketing Manager", "Data Manager",
  
  // Specialists
  "IT Administrator", "Security Analyst", "DevOps Engineer", "Data Scientist",
  "Software Engineer", "Solutions Architect", "Business Analyst", "Consultant"
];

export const PERSONA_SENIORITY_LEVELS = [
  "C-Suite", "Executive", "Senior", "Mid-Level", "Junior", "Entry-Level"
];

export const PERSONA_DEPARTMENTS = [
  "IT", "Engineering", "Product", "Operations", "Security", "Data & Analytics",
  "Sales", "Marketing", "Finance", "HR", "Procurement", "Legal", "Compliance",
  "Customer Success", "Support", "Research & Development", "Quality Assurance"
];

export const PERSONA_DECISION_ROLES = [
  "Primary Decision Maker", "Key Influencer", "Technical Evaluator",
  "Budget Holder", "User/Champion", "Procurement Contact", "Legal Approver",
  "Security Reviewer", "Implementation Lead", "End User"
];

export const COMPANY_STAGES = [
  "Startup", "Early Stage", "Growth", "Scale-up", "Established", 
  "Enterprise", "Public Company", "Mature", "Turnaround"
];

export const TECH_STACK = [
  // Cloud Providers
  "AWS", "Microsoft Azure", "Google Cloud", "IBM Cloud", "Oracle Cloud",
  
  // CRM & Sales
  "Salesforce", "HubSpot", "Microsoft Dynamics", "Pipedrive", "Zoho CRM",
  
  // Marketing Automation
  "Marketo", "Pardot", "Mailchimp", "Constant Contact", "Campaign Monitor",
  
  // Productivity
  "Microsoft Office 365", "Google Workspace", "Slack", "Microsoft Teams", "Zoom",
  
  // ERP & Business
  "SAP", "Oracle ERP", "NetSuite", "QuickBooks", "Xero",
  
  // Security
  "Okta", "Ping Identity", "CyberArk", "Palo Alto Networks", "Crowdstrike",
  
  // Development
  "GitHub", "GitLab", "Jira", "Confluence", "Docker", "Kubernetes"
];

export const GROWTH_STAGES = [
  "High Growth (>50% YoY)", "Moderate Growth (20-50% YoY)", 
  "Stable Growth (5-20% YoY)", "Slow Growth (<5% YoY)", 
  "Flat/Declining", "Post-Merger", "Restructuring"
];

export const FUNDING_STATUS = [
  "Self-Funded", "Angel Funded", "Seed Stage", "Series A", "Series B",
  "Series C+", "Pre-IPO", "Public Company", "Private Equity Backed",
  "Acquisition Target", "Recently Acquired"
];

export const INTENT_SIGNALS = [
  "Technology Research", "Vendor Evaluation", "RFP Activity", 
  "Budget Allocation", "Hiring Surge", "Leadership Changes",
  "Compliance Requirements", "Digital Transformation", "Cost Reduction",
  "Security Incidents", "Growth Initiatives", "Product Launches"
];

export const BUYING_TRIGGERS = [
  "New Compliance Requirements", "Security Breach", "System Failure",
  "Merger/Acquisition", "New Leadership", "Budget Approval",
  "Competitor Pressure", "Customer Demands", "Growth Milestone",
  "Technology Refresh", "Contract Renewal", "Audit Findings"
];

export const SEASONAL_PATTERNS = [
  "Q4 Budget Flush", "Q1 New Initiatives", "Q2 Implementation",
  "Q3 Evaluation", "End of Fiscal Year", "Back-to-School",
  "Holiday Season", "Summer Slowdown", "Year-End Push"
];

export const BUDGET_INDICATORS = [
  "Recently Funded", "Budget Increase", "Cost Center Focus",
  "ROI Driven", "Operational Budget", "Capital Expenditure",
  "Emergency Budget", "Pilot Budget", "Enterprise Budget",
  "Departmental Budget", "Multi-Year Contract", "Subscription Model"
];

export const TIMEZONES = [
  "EST (UTC-5)", "CST (UTC-6)", "MST (UTC-7)", "PST (UTC-8)",
  "GMT (UTC+0)", "CET (UTC+1)", "EET (UTC+2)", "IST (UTC+5:30)",
  "JST (UTC+9)", "AEST (UTC+10)", "NZST (UTC+12)"
];

export const ICP_TEMPLATES_CATEGORIES = [
  "Technology", "Healthcare", "Financial Services", "Manufacturing",
  "Retail", "Education", "Government", "Professional Services"
];

export const ICP_USE_CASES = [
  "Digital Transformation", "Cloud Migration", "Security Enhancement",
  "Cost Reduction", "Operational Efficiency", "Customer Experience",
  "Data Analytics", "Compliance", "Innovation", "Growth Acceleration",
  "Process Automation", "Infrastructure Modernization"
];

export const ICP_STATUSES = [
  { value: 'draft', label: 'Draft', description: 'Work in progress' },
  { value: 'active', label: 'Active', description: 'Currently being used' },
  { value: 'archived', label: 'Archived', description: 'No longer active' }
] as const;