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
