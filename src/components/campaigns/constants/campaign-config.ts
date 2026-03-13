export const EMPLOYEE_RANGES = [
  { label: "1-200", min: 1, max: 200 },
  { label: "201-1000", min: 201, max: 1000 },
  { label: "1000+", min: 1000, max: null }
] as const;

export const REVENUE_RANGES = [
  { label: "< $100M", min: 0, max: 100000000 },
  { label: "$100M - $1B", min: 100000000, max: 1000000000 },
  { label: "$1B+", min: 1000000000, max: null }
] as const;

export const MARKET_SEGMENTS = [
  { value: "Enterprise", label: "Enterprise (1000+ employees, $1B+ revenue)" },
  { value: "Mid-Market", label: "Mid-Market (201-1000 employees, $100M-$1B revenue)" },
  { value: "SMB", label: "SMB (1-200 employees, <$100M revenue)" }
] as const;

export const MANAGEMENT_LEVELS = ["C-Level", "VP", "Director", "Manager", "Non-Manager"] as const;

export interface SequenceStep {
  day: number;
  action: string;
  description: string;
}

export interface SequenceTemplate {
  name: string;
  description: string;
  steps: SequenceStep[];
}

export const SEQUENCE_TEMPLATES: Record<string, SequenceTemplate> = {
  'enterprise': {
    name: 'Enterprise Sales',
    description: '5-touch, 14 days',
    steps: [
      { day: 1, action: 'Email', description: 'Research-based personalized introduction' },
      { day: 3, action: 'LinkedIn', description: 'Connection request with note' },
      { day: 7, action: 'Email', description: 'Value-focused follow-up' },
      { day: 10, action: 'Phone', description: 'Executive briefing offer' },
      { day: 14, action: 'Email', description: 'Case study share' }
    ]
  },
  'smb': {
    name: 'Velocity Sales',
    description: '4-touch, 10 days',
    steps: [
      { day: 1, action: 'Email', description: 'Quick value proposition' },
      { day: 3, action: 'Email', description: 'Follow-up with demo offer' },
      { day: 7, action: 'Phone', description: 'Direct call' },
      { day: 10, action: 'Email', description: 'Last attempt with offer' }
    ]
  },
  'partner': {
    name: 'Partnership',
    description: '4-touch, 14 days',
    steps: [
      { day: 1, action: 'Email', description: 'Partnership introduction' },
      { day: 5, action: 'LinkedIn', description: 'Connect and engage' },
      { day: 10, action: 'Email', description: 'Collaboration proposal' },
      { day: 14, action: 'Meeting', description: 'Strategy session' }
    ]
  }
};

export type TemplateKey = keyof typeof SEQUENCE_TEMPLATES;

// ─── Fuel Line Types ───────────────────────────────────────────────────────────
export type FuelLineType = 'abm' | 'technographic' | 'firmographic' | 'persona';

export interface FuelLineConfig {
  label: string;
  description: string;
  icon: string; // lucide icon name
  defaultTemplate: TemplateKey;
  defaultManagementLevels: string[];
  defaultMarketSegments: string[];
  defaultDataSource: 'all' | 'crm' | 'database';
}

export const FUEL_LINE_TYPES: Record<FuelLineType, FuelLineConfig> = {
  abm: {
    label: 'ABM',
    description: 'Signal-triggered accounts with high-touch sequences',
    icon: 'Crosshair',
    defaultTemplate: 'enterprise',
    defaultManagementLevels: ['C-Level', 'VP'],
    defaultMarketSegments: ['Enterprise'],
    defaultDataSource: 'all',
  },
  technographic: {
    label: 'Technographic',
    description: 'Target by tech stack — reach companies using specific tools',
    icon: 'Cpu',
    defaultTemplate: 'enterprise',
    defaultManagementLevels: ['VP', 'Director'],
    defaultMarketSegments: ['Enterprise', 'Mid-Market'],
    defaultDataSource: 'database',
  },
  firmographic: {
    label: 'Firmographic',
    description: 'Filter by company size, revenue, and industry segments',
    icon: 'Building2',
    defaultTemplate: 'enterprise',
    defaultManagementLevels: ['VP', 'C-Level'],
    defaultMarketSegments: [],
    defaultDataSource: 'all',
  },
  persona: {
    label: 'Persona',
    description: 'Lead with job titles, seniority, and departments first',
    icon: 'UserSearch',
    defaultTemplate: 'smb',
    defaultManagementLevels: ['Director', 'Manager'],
    defaultMarketSegments: [],
    defaultDataSource: 'all',
  },
};

// ─── Signal-to-Fuel-Line Mapping (Phase 3) ─────────────────────────────────────
export const SIGNAL_FUEL_LINE_MAP: Record<string, { fuelLine: FuelLineType; template: TemplateKey }> = {
  intent: { fuelLine: 'abm', template: 'enterprise' },
  tech_change: { fuelLine: 'technographic', template: 'enterprise' },
  funding: { fuelLine: 'abm', template: 'enterprise' },
  expansion: { fuelLine: 'firmographic', template: 'enterprise' },
  new_hire: { fuelLine: 'persona', template: 'smb' },
};
