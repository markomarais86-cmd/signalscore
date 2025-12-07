// Agent Discover Contacts - Find additional decision-makers at a company
// Searches for executives with target titles and returns full contact details

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscoverRequest {
  company_name: string;
  company_domain?: string;
  company_linkedin_url?: string;
  target_titles: string[];
  org_id: string;
  max_contacts?: number;
  exclude_emails?: string[];
}

const SYSTEM_PROMPT = `You are a professional executive finder and contact researcher. Your job is to find decision-makers at a specific company.

RESEARCH INSTRUCTIONS:
1. Search for executives at the company with the specified target titles
2. For each person found, gather complete contact information
3. Verify they are CURRENTLY at the company (not former employees)
4. Return accurate, verified data only - never fabricate

DATA TO FIND FOR EACH CONTACT:
- Full name (first_name, last_name)
- Current title at this company
- Email address (if publicly available or derivable from pattern)
- Phone numbers: direct line, cell phone, extension
- LinkedIn profile URL
- Facebook/Twitter if available
- Their location (city, state, country)

FORMATTING RULES:
- Phone: +[country] ([area]) [exchange]-[number]
- Names: Title Case
- Email: lowercase
- URLs: Include https://

QUALITY RULES:
- Only return contacts you're confident about
- Include sources/citations for verification
- Assign confidence level (high/medium/low) to each contact
- Do not include contacts who have left the company`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      company_name, 
      company_domain, 
      company_linkedin_url,
      target_titles, 
      org_id,
      max_contacts = 10,
      exclude_emails = []
    }: DiscoverRequest = await req.json();
    
    console.log(`[DiscoverContacts] Searching for contacts at ${company_name}`);
    console.log(`[DiscoverContacts] Target titles: ${target_titles.join(', ')}`);
    console.log(`[DiscoverContacts] Max contacts: ${max_contacts}`);

    if (!company_name) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'company_name is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = buildDiscoveryPrompt(
      company_name, 
      company_domain, 
      company_linkedin_url,
      target_titles, 
      max_contacts,
      exclude_emails
    );

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_discovered_contacts',
              description: 'Return the list of discovered executive contacts',
              parameters: getDiscoverySchema()
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'return_discovered_contacts' } }
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('[DiscoverContacts] Rate limit exceeded');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.',
          contacts: []
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        console.error('[DiscoverContacts] Out of credits');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'AI credits exhausted.',
          contacts: []
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    
    let discoveredContacts: any[] = [];
    let companySummary: any = {};
    
    try {
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        discoveredContacts = parsed.contacts || [];
        companySummary = parsed.company_summary || {};
      }
    } catch (parseError) {
      console.error('[DiscoverContacts] Failed to parse AI response:', parseError);
    }

    // Filter out excluded emails
    if (exclude_emails.length > 0) {
      const excludeSet = new Set(exclude_emails.map(e => e.toLowerCase()));
      discoveredContacts = discoveredContacts.filter(c => 
        !c.email || !excludeSet.has(c.email.toLowerCase())
      );
    }

    // Limit to max_contacts
    discoveredContacts = discoveredContacts.slice(0, max_contacts);

    // Add metadata
    discoveredContacts = discoveredContacts.map(contact => ({
      ...contact,
      discovered_from_company: company_name,
      discovered_at: new Date().toISOString(),
      org_id
    }));

    console.log(`[DiscoverContacts] Found ${discoveredContacts.length} contacts`);

    return new Response(JSON.stringify({
      success: true,
      company_name,
      company_summary: companySummary,
      contacts: discoveredContacts,
      contacts_found: discoveredContacts.length,
      target_titles_searched: target_titles
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DiscoverContacts] Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      contacts: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function buildDiscoveryPrompt(
  companyName: string, 
  domain?: string, 
  linkedinUrl?: string,
  targetTitles: string[] = [],
  maxContacts: number = 10,
  excludeEmails: string[] = []
): string {
  return `Find decision-makers at this company:

=== COMPANY INFORMATION ===
Company Name: ${companyName}
Domain: ${domain || 'Unknown'}
LinkedIn: ${linkedinUrl || 'Search for it'}

=== TARGET TITLES TO FIND ===
${targetTitles.join(', ')}

=== INSTRUCTIONS ===
1. Search for the company's leadership/executive team
2. Find people with the target titles listed above
3. For each person, gather:
   - Full name
   - Current title
   - Email (if publicly available)
   - Phone numbers (direct, cell)
   - LinkedIn URL
   - Location

4. Verify each person is CURRENTLY at this company
5. Return up to ${maxContacts} contacts
6. Include sources/citations for each contact

${excludeEmails.length > 0 ? `\n=== EXCLUDE THESE EMAILS ===\n${excludeEmails.join(', ')}\n` : ''}

Also provide a brief company summary with:
- Main phone number
- Headquarters address
- Industry
- Employee count
- Website

Use the return_discovered_contacts function with your findings.`;
}

function getDiscoverySchema(): any {
  return {
    type: 'object',
    properties: {
      company_summary: {
        type: 'object',
        properties: {
          company_name: { type: 'string' },
          website: { type: 'string' },
          main_phone: { type: 'string' },
          hq_address: { type: 'string' },
          hq_city: { type: 'string' },
          hq_state: { type: 'string' },
          hq_country: { type: 'string' },
          industry: { type: 'string' },
          employee_count: { type: 'number' },
          linkedin_url: { type: 'string' }
        }
      },
      contacts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            first_name: { type: 'string', description: 'First name (proper case)' },
            last_name: { type: 'string', description: 'Last name (proper case)' },
            email: { type: 'string', description: 'Email address (lowercase)' },
            email_status: { 
              type: 'string', 
              enum: ['verified', 'pattern_derived', 'not_found'],
              description: 'How the email was determined' 
            },
            phone_number: { type: 'string', description: 'Primary phone' },
            cell_phone: { type: 'string', description: 'Mobile number' },
            direct_phone: { type: 'string', description: 'Direct dial' },
            extension: { type: 'string', description: 'Extension' },
            linkedin_url: { type: 'string', description: 'LinkedIn profile URL' },
            facebook_url: { type: 'string', description: 'Facebook profile' },
            twitter_url: { type: 'string', description: 'Twitter/X profile' },
            current_title: { type: 'string', description: 'Current job title' },
            current_company: { type: 'string', description: 'Company name' },
            city: { type: 'string' },
            state_province: { type: 'string' },
            country: { type: 'string' },
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Source URLs for this contact'
            },
            confidence: { 
              type: 'string', 
              enum: ['high', 'medium', 'low'],
              description: 'Confidence in this contact data' 
            }
          },
          required: ['first_name', 'last_name', 'current_title', 'confidence']
        },
        description: 'List of discovered contacts'
      },
      search_notes: {
        type: 'string',
        description: 'Notes about the search process or limitations'
      }
    },
    required: ['contacts']
  };
}
