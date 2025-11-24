export interface HelpItem {
  id: string;
  title: string;
  description: string;
  content: string;
  keywords: string[];
  category: 'quickstart' | 'concepts' | 'workflows' | 'troubleshooting';
  relatedPages: string[];
  videoUrl?: string;
}

export const helpDatabase: HelpItem[] = [
  // Quick Start
  {
    id: 'platform-overview',
    title: 'Platform Overview',
    description: 'Get started with LaunchPulse in 5 minutes',
    content: `LaunchPulse helps you identify and prioritize your ideal customers using AI-powered fit scoring. 

**Key Features:**
- Upload account and lead data from CSV or sync with your CRM
- Define multiple ICP (Ideal Customer Profile) segments
- Get AI-powered fit scores (0-100) for every account
- Build targeted campaigns with qualified contacts
- Track performance and optimize your ICP over time`,
    keywords: ['overview', 'getting started', 'introduction', 'quick start', 'basics'],
    category: 'quickstart',
    relatedPages: ['/'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  {
    id: 'upload-csv',
    title: 'Uploading CSV Data',
    description: 'Import accounts and leads from CSV files',
    content: `**Step-by-step:**
1. Navigate to Data Upload page
2. Download the CSV template to see required columns
3. Prepare your data matching the template format
4. Click "Upload CSV" and select your file
5. Map your columns to LaunchPulse fields
6. Review validation results and fix any errors
7. Confirm upload to import data

**Required Fields:**
- Accounts: domain, name, employee_count
- Leads: email, first_name, last_name, company

**Tips:**
- Use consistent formatting for countries and industries
- Include as many enrichment fields as possible
- Remove duplicates before uploading`,
    keywords: ['upload', 'csv', 'import', 'data', 'file', 'accounts', 'leads'],
    category: 'quickstart',
    relatedPages: ['/data-upload'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  {
    id: 'create-icp',
    title: 'Creating Your First ICP',
    description: 'Define your ideal customer profile',
    content: `**ICP Creation Steps:**
1. Go to ICP Manager
2. Click "Create New ICP"
3. Choose a template or start from scratch
4. Define firmographic criteria:
   - Industries and sub-industries
   - Company size ranges
   - Geographies and regions
   - Revenue ranges
   - Tech stack
5. Add persona filters for buyer roles
6. Save and activate your ICP

**Best Practices:**
- Start with 2-3 ICPs maximum
- Use closed-won data to inform criteria
- Test different segments separately
- Refine based on conversion data`,
    keywords: ['icp', 'create', 'profile', 'segment', 'define', 'criteria'],
    category: 'quickstart',
    relatedPages: ['/icp-manager'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },

  // Key Concepts
  {
    id: 'icp-scoring',
    title: 'Understanding ICP Fit Scores',
    description: 'Learn how accounts are scored against your ICP',
    content: `**ICP Fit Score (0-100):**
- **80-100 (High Fit):** Strong match across all criteria. Prioritize these accounts.
- **60-79 (Medium Fit):** Good match with some gaps. Review individually.
- **0-59 (Low Fit):** Poor match. Consider for future nurture only.

**How Scoring Works:**
1. Each ICP criterion is weighted by importance
2. Account attributes are matched against criteria
3. Partial matches receive proportional points
4. Final score is normalized to 0-100 scale

**Factors Considered:**
- Industry match (high weight)
- Company size alignment
- Geographic location
- Technology stack overlap
- Revenue range match
- Growth signals`,
    keywords: ['icp', 'score', 'fit', 'scoring', 'algorithm', 'high fit', 'medium fit', 'low fit'],
    category: 'concepts',
    relatedPages: ['/', '/icp-manager', '/accounts'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  {
    id: 'tam-sam-som',
    title: 'TAM, SAM, and SOM Explained',
    description: 'Understanding your market size metrics',
    content: `**Market Sizing:**

**TAM (Total Addressable Market):**
All accounts matching your broad industry/category. Represents theoretical maximum.

**SAM (Serviceable Addressable Market):**
Subset of TAM that matches your ICP criteria. Accounts you can realistically target.

**SOM (Serviceable Obtainable Market):**
Portion of SAM you can capture based on your resources, competition, and market penetration.

**How LaunchPulse Calculates:**
- TAM: All accounts in your database
- SAM: High + Medium fit accounts (score > 60)
- SOM: High fit accounts (score > 80) you have capacity to pursue

**Use Cases:**
- Pitch investors on market opportunity
- Set realistic pipeline targets
- Prioritize geographic expansion
- Allocate sales resources`,
    keywords: ['tam', 'sam', 'som', 'market', 'size', 'addressable', 'opportunity'],
    category: 'concepts',
    relatedPages: ['/'],
  },
  {
    id: 'data-sources',
    title: 'Data Sources and Enrichment',
    description: 'How your data is enhanced with external sources',
    content: `**Data Enrichment Process:**

LaunchPulse enhances your uploaded data with information from multiple sources:

**Enrichment Providers:**
- Clearbit: Firmographic data, logos, tech stack
- ZoomInfo: Employee counts, revenue, contacts
- Apollo: B2B contact data, buying signals
- PDL (People Data Labs): Person-level enrichment

**What Gets Enriched:**
- Missing company details (size, industry, revenue)
- Employee count and growth trends
- Technology stack and integrations
- Contact information and job titles
- Funding and financial data

**Data Source Attribution:**
Each account shows which provider contributed data. This helps you:
- Track enrichment coverage
- Understand data freshness
- Validate accuracy
- Monitor API usage and costs`,
    keywords: ['data', 'sources', 'enrichment', 'clearbit', 'zoominfo', 'apollo', 'pdl'],
    category: 'concepts',
    relatedPages: ['/data-upload', '/settings', '/accounts'],
  },

  // Workflows
  {
    id: 'build-campaign',
    title: 'Building a Target Account List',
    description: 'Create and export campaign-ready account lists',
    content: `**Campaign Building Workflow:**

1. **Filter Accounts:**
   - Go to Accounts page
   - Apply ICP filter (select your target ICP)
   - Add firmographic filters (industry, size, geo)
   - Set minimum fit score threshold

2. **Add Persona Filters:**
   - Select target job titles
   - Choose seniority levels
   - Filter by departments
   - Set max contacts per account

3. **Review and Refine:**
   - Check total account count
   - Review top accounts
   - Adjust filters if needed

4. **Export:**
   - Click "Build Campaign"
   - Choose export format (CSV, CRM sync)
   - Name your campaign
   - Download or sync to outreach tool

**Pro Tips:**
- Start with high-fit accounts only
- Limit to 100-200 accounts per campaign
- Include decision-makers and influencers
- Test messaging with a small batch first`,
    keywords: ['campaign', 'build', 'export', 'target', 'list', 'accounts', 'filter'],
    category: 'workflows',
    relatedPages: ['/accounts', '/leads'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  {
    id: 'crm-integration',
    title: 'Integrating with Your CRM',
    description: 'Sync LaunchPulse data with Salesforce or HubSpot',
    content: `**CRM Integration Setup:**

**Salesforce:**
1. Go to Settings → Integrations
2. Click "Connect Salesforce"
3. Authorize LaunchPulse in Salesforce
4. Map fields between systems
5. Configure sync frequency (hourly, daily)
6. Enable bidirectional sync if needed

**HubSpot:**
1. Go to Settings → Integrations
2. Click "Connect HubSpot"
3. Authorize LaunchPulse
4. Select properties to sync
5. Set sync schedule

**What Syncs:**
- Account/Company records with fit scores
- Contact records with persona matches
- ICP segment assignments
- Enriched firmographic data
- Lead scoring updates

**Best Practices:**
- Start with one-way sync (LaunchPulse → CRM)
- Test with a small subset first
- Map custom fields carefully
- Monitor sync logs for errors`,
    keywords: ['crm', 'integration', 'salesforce', 'hubspot', 'sync', 'connect'],
    category: 'workflows',
    relatedPages: ['/settings'],
  },
  {
    id: 'closed-won-analysis',
    title: 'Analyzing Closed-Won Deals',
    description: 'Use historical wins to refine your ICP',
    content: `**Closed-Won Analysis:**

Upload your closed-won deals to discover patterns and optimize your ICP.

**Steps:**
1. Go to Data Upload
2. Select "Closed-Won Deals" tab
3. Upload CSV with: account_id, close_date, deal_value
4. LaunchPulse analyzes firmographic patterns
5. Review AI-generated insights
6. Apply recommendations to your ICP

**Insights Generated:**
- Most common industries in won deals
- Optimal company size ranges
- High-converting geographies
- Technology stack correlations
- Deal size by segment

**Using Insights:**
- Update ICP criteria to match winners
- Create lookalike segments
- Deprioritize low-converting segments
- Identify expansion opportunities`,
    keywords: ['closed won', 'deals', 'analysis', 'winners', 'optimize', 'insights'],
    category: 'workflows',
    relatedPages: ['/data-upload', '/icp-manager'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },

  // Troubleshooting
  {
    id: 'upload-errors',
    title: 'Fixing CSV Upload Errors',
    description: 'Common issues and how to resolve them',
    content: `**Common Upload Errors:**

**"Invalid domain format":**
- Ensure domains don't include http:// or www.
- Use format: company.com

**"Missing required fields":**
- Check that domain, name are present for accounts
- Ensure email, first_name, last_name for contacts

**"Duplicate entries":**
- Remove duplicate rows before upload
- Use domain as unique identifier for accounts
- Use email as unique identifier for contacts

**"Country not recognized":**
- Use ISO 2-letter country codes (US, GB, CA)
- Or full country names (United States, United Kingdom)

**"Date format invalid":**
- Use YYYY-MM-DD format for all dates

**Character Encoding Issues:**
- Save CSV as UTF-8 encoding
- Remove special characters that don't display correctly`,
    keywords: ['upload', 'error', 'fix', 'csv', 'problem', 'troubleshoot', 'validation'],
    category: 'troubleshooting',
    relatedPages: ['/data-upload'],
  },
  {
    id: 'low-fit-scores',
    title: 'Why Are My Fit Scores Low?',
    description: 'Understanding and improving low fit scores',
    content: `**Common Causes of Low Scores:**

**1. ICP Too Narrow:**
Your criteria may be overly restrictive. Try:
- Broadening industry selections
- Expanding company size ranges
- Including adjacent geographies

**2. Missing Data:**
Accounts lack enrichment data needed for scoring. Solutions:
- Enable enrichment in Settings
- Upload more complete data
- Wait for enrichment to complete

**3. Misaligned Criteria:**
Your ICP doesn't match your database. Consider:
- Analyzing closed-won deals for patterns
- Creating multiple ICPs for different segments
- Adjusting weight of criteria

**4. Database Composition:**
Your uploaded accounts may not include ideal targets. Actions:
- Source new lists from external databases
- Use lookalike modeling on high-fit accounts
- Expand data sources

**How to Diagnose:**
- Check data completeness % on accounts
- Review ICP match reasons on low-scoring accounts
- Compare criteria to high-scoring accounts`,
    keywords: ['low', 'score', 'fit', 'poor', 'bad', 'improve', 'increase'],
    category: 'troubleshooting',
    relatedPages: ['/accounts', '/icp-manager'],
  },
  {
    id: 'enrichment-not-working',
    title: 'Enrichment Not Working',
    description: 'Troubleshooting data enrichment issues',
    content: `**Enrichment Troubleshooting:**

**Check API Keys:**
1. Go to Settings → Enrichment
2. Verify API keys are configured
3. Test connection for each provider
4. Check API credits/quota remaining

**Common Issues:**

**"Enrichment pending for days":**
- Check rate limits in Settings
- Increase batch size if using free trial
- Verify account has valid domain

**"No enrichment data returned":**
- Domain may not be in provider databases
- Try alternative enrichment providers
- Manually add data for critical accounts

**"Enrichment costs too high":**
- Adjust auto-enrichment settings
- Enrich only high-priority accounts
- Use free tier providers first (Clearbit free)
- Set monthly spending caps

**Priority Order:**
LaunchPulse tries providers in this order:
1. Clearbit (free tier if available)
2. ZoomInfo (if API key configured)
3. Apollo (if credits available)
4. PDL (fallback for contact data)`,
    keywords: ['enrichment', 'not working', 'api', 'key', 'stuck', 'pending', 'error'],
    category: 'troubleshooting',
    relatedPages: ['/settings', '/accounts'],
  },

  // Additional Help Items
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Speed up your workflow with shortcuts',
    content: `**Global Shortcuts:**
- \`Cmd/Ctrl + K\` - Open command palette
- \`Cmd/Ctrl + /\` - Open help panel
- \`Cmd/Ctrl + ,\` - Open settings
- \`Esc\` - Close dialogs/panels

**Navigation:**
- \`G then D\` - Go to Dashboard
- \`G then A\` - Go to Accounts
- \`G then L\` - Go to Leads
- \`G then I\` - Go to ICP Manager

**Accounts Page:**
- \`F\` - Focus filter search
- \`Cmd/Ctrl + E\` - Export accounts
- \`Cmd/Ctrl + N\` - Create new campaign

**Data Upload:**
- \`U\` - Upload CSV
- \`D\` - Download template`,
    keywords: ['keyboard', 'shortcuts', 'hotkeys', 'navigation', 'speed'],
    category: 'workflows',
    relatedPages: ['/', '/accounts', '/leads', '/icp-manager', '/data-upload'],
  },
  {
    id: 'executive-dashboard',
    title: 'Understanding Your Dashboard',
    description: 'Key metrics and what they mean',
    content: `**Dashboard Overview:**

**ICP Coverage:**
Shows what % of your database matches your ICP criteria. Target: 20-40% for focused ICPs.

**Fit Distribution:**
- High Fit: Prioritize for outreach
- Medium Fit: Nurture or research
- Low Fit: Exclude from active campaigns

**Geographic Breakdown:**
See where your ideal accounts are concentrated. Use for territory planning.

**Data Quality Score:**
Tracks completeness of account data. Higher = better scoring accuracy.

**Trends:**
- Week-over-week changes
- New accounts added
- Fit score improvements
- Enrichment progress

**Taking Action:**
- Click any card to drill down
- Filter by ICP, fit score, geography
- Export filtered lists
- Set up alerts for key thresholds`,
    keywords: ['dashboard', 'metrics', 'kpi', 'overview', 'executive', 'summary'],
    category: 'concepts',
    relatedPages: ['/'],
  },
  {
    id: 'account-filters',
    title: 'Filtering Accounts',
    description: 'Find the right accounts quickly',
    content: `**Available Filters:**

**Fit & ICP:**
- ICP Segment
- Fit Score range (0-100)
- High/Medium/Low fit buckets

**Firmographics:**
- Industry (primary and sub-industry)
- Employee count ranges
- Revenue ranges
- Geography (country, state, city)

**Enrichment:**
- Data source (CRM, Upload, Enrichment)
- Enrichment status
- Data completeness %
- Last updated date

**Engagement:**
- Has contacts (yes/no)
- Campaign-ready
- Last export date

**Advanced:**
- Technology stack
- Funding stage
- Growth signals

**Combining Filters:**
Filters work together (AND logic). Narrow down to your precise target list.

**Saving Filters:**
Use Segments feature to save commonly-used filter combinations.`,
    keywords: ['filter', 'search', 'find', 'accounts', 'narrow', 'refine'],
    category: 'workflows',
    relatedPages: ['/accounts'],
  },
];

export const videoTutorials = [
  {
    id: 'quick-tour',
    title: 'LaunchPulse Quick Tour',
    description: '5-minute overview of the platform',
    duration: '5:32',
    category: 'Getting Started',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
  },
  {
    id: 'upload-data',
    title: 'Uploading Your First Data',
    description: 'Step-by-step CSV upload tutorial',
    duration: '8:15',
    category: 'Getting Started',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
  },
  {
    id: 'create-icp',
    title: 'Creating Your First ICP',
    description: 'Define your ideal customer profile',
    duration: '12:45',
    category: 'Getting Started',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
  },
  {
    id: 'scoring-explained',
    title: 'Understanding ICP Fit Scores',
    description: 'Deep dive into the scoring algorithm',
    duration: '15:20',
    category: 'Key Concepts',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
  },
  {
    id: 'campaign-builder',
    title: 'Campaign Builder Walkthrough',
    description: 'Build and export target account lists',
    duration: '10:30',
    category: 'Key Features',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
  },
  {
    id: 'enrichment-setup',
    title: 'Setting Up Data Enrichment',
    description: 'Configure enrichment providers and API keys',
    duration: '7:40',
    category: 'Key Features',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
  },
  {
    id: 'crm-integration',
    title: 'CRM Integration Guide',
    description: 'Connect Salesforce or HubSpot',
    duration: '14:10',
    category: 'Advanced',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
  },
  {
    id: 'multi-icp',
    title: 'Multi-ICP Strategy',
    description: 'Managing multiple customer segments',
    duration: '18:25',
    category: 'Advanced',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
  },
  {
    id: 'closed-won-analysis',
    title: 'Closed-Won Deal Analysis',
    description: 'Optimize ICP using historical wins',
    duration: '11:55',
    category: 'Advanced',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
  },
];
