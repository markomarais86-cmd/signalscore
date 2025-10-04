/**
 * Persona Mapping System
 * Maps job titles to standardized personas for contact enrichment
 */

export type PersonaType = 
  | 'Technical Decision Maker'
  | 'Business Decision Maker'
  | 'IT Decision Maker'
  | 'Technical Influencer'
  | 'Business Influencer'
  | 'End User'
  | 'Unknown';

interface PersonaPattern {
  keywords: string[];
  persona: PersonaType;
  priority: number; // Higher priority = checked first
}

const PERSONA_PATTERNS: PersonaPattern[] = [
  // C-Level Technical Decision Makers
  {
    keywords: ['cto', 'chief technology officer', 'chief technical officer', 'vp engineering', 'vp of engineering', 'chief information officer', 'cio', 'chief digital officer', 'cdo'],
    persona: 'Technical Decision Maker',
    priority: 10
  },
  
  // C-Level Business Decision Makers
  {
    keywords: ['ceo', 'chief executive officer', 'president', 'founder', 'co-founder', 'owner', 'managing director', 'cfo', 'chief financial officer', 'coo', 'chief operating officer', 'cmo', 'chief marketing officer'],
    persona: 'Business Decision Maker',
    priority: 10
  },
  
  // VP/Director Level Technical
  {
    keywords: ['director of engineering', 'director of technology', 'head of engineering', 'head of technology', 'engineering manager', 'director of software', 'head of software', 'director of it', 'head of it', 'it director', 'director of infrastructure', 'head of infrastructure'],
    persona: 'Technical Decision Maker',
    priority: 8
  },
  
  // VP/Director Level IT
  {
    keywords: ['director of information technology', 'it manager', 'systems manager', 'infrastructure manager', 'operations manager', 'director of operations', 'head of operations'],
    persona: 'IT Decision Maker',
    priority: 8
  },
  
  // VP/Director Level Business
  {
    keywords: ['vp', 'vice president', 'director of product', 'head of product', 'product director', 'director of strategy', 'head of strategy', 'director of sales', 'head of sales', 'director of marketing', 'head of marketing'],
    persona: 'Business Decision Maker',
    priority: 8
  },
  
  // Senior Technical Roles (Influencers)
  {
    keywords: ['senior engineer', 'lead engineer', 'principal engineer', 'staff engineer', 'senior developer', 'lead developer', 'principal developer', 'senior software', 'lead software', 'architect', 'technical architect', 'solutions architect', 'enterprise architect'],
    persona: 'Technical Influencer',
    priority: 6
  },
  
  // Senior Business Roles (Influencers)
  {
    keywords: ['senior product manager', 'lead product manager', 'principal product manager', 'senior program manager', 'senior project manager', 'senior analyst', 'lead analyst'],
    persona: 'Business Influencer',
    priority: 6
  },
  
  // Mid-Level Technical (Influencers)
  {
    keywords: ['engineer', 'developer', 'programmer', 'software engineer', 'data engineer', 'devops', 'sre', 'site reliability engineer', 'security engineer', 'qa engineer', 'quality assurance'],
    persona: 'Technical Influencer',
    priority: 4
  },
  
  // Mid-Level Business (Influencers)
  {
    keywords: ['product manager', 'program manager', 'project manager', 'business analyst', 'product owner', 'scrum master'],
    persona: 'Business Influencer',
    priority: 4
  },
  
  // IT Staff
  {
    keywords: ['it specialist', 'it support', 'help desk', 'desktop support', 'system administrator', 'sysadmin', 'network administrator', 'database administrator', 'dba'],
    persona: 'IT Decision Maker',
    priority: 3
  },
  
  // End Users
  {
    keywords: ['coordinator', 'assistant', 'associate', 'specialist', 'intern', 'trainee', 'junior'],
    persona: 'End User',
    priority: 2
  }
];

/**
 * Maps a job title to a standardized persona
 * @param title - The raw job title from the contact
 * @returns The mapped persona type
 */
export function mapTitleToPersona(title: string | null | undefined): PersonaType {
  if (!title || title.trim() === '') {
    return 'Unknown';
  }

  const normalizedTitle = title.toLowerCase().trim();

  // Sort patterns by priority (descending) and check each one
  const sortedPatterns = [...PERSONA_PATTERNS].sort((a, b) => b.priority - a.priority);

  for (const pattern of sortedPatterns) {
    for (const keyword of pattern.keywords) {
      if (normalizedTitle.includes(keyword)) {
        return pattern.persona;
      }
    }
  }

  return 'Unknown';
}

/**
 * Enriches a contact with persona information
 * @param contact - Contact object with title_raw
 * @returns Contact with persona field populated
 */
export function enrichContactWithPersona(contact: any): any {
  return {
    ...contact,
    persona: mapTitleToPersona(contact.title_raw || contact.title)
  };
}

/**
 * Determines if a contact is "campaign-ready" (has all required fields)
 * @param contact - Contact object
 * @returns Boolean indicating if contact is campaign-ready
 */
export function isCampaignReady(contact: any): boolean {
  return !!(
    contact.email &&
    contact.email.includes('@') &&
    (contact.title_raw || contact.title) &&
    contact.persona &&
    contact.persona !== 'Unknown'
  );
}

/**
 * Batch enriches multiple contacts with persona mapping
 * @param contacts - Array of contact objects
 * @returns Array of enriched contacts
 */
export function enrichContactsBatch(contacts: any[]): any[] {
  return contacts.map(enrichContactWithPersona);
}
