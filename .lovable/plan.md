

# Build a Detailed ICP for 91.Life from the Persona Playbook

## What I Extracted from Your Document

Your uploaded **91Life Persona Playbook v2.1** defines a comprehensive ICP targeting **4 hospital segments** with **20+ buyer personas**. Here's the summary:

### Target Segments
| Segment | Size | Beds |
|---------|------|------|
| Academic Medical Centers | Large | 300-1,000+ |
| Regional Integrated Health Systems | Mid-Large | 100-900 |
| Community/Critical-Access Hospitals | Small | 30-150 |
| Private/Specialty Heart Institutes | Small-Mid | 1-60 |

### Personas Identified (20+)
**Academic Medical Centers:** Clinical Innovation Champion (EP Division Chief), Digital Transformation Executive (VP Digital Strategy), Clinical IT Leader, CISO, Chief AI & Data Officer, Advanced Practice NP, Finance & Operations Director, Strategic Sourcing Director, Patient Experience Officer

**Regional Health Systems:** System CMO, Service Line Director (Cardiology), Enterprise Technology VP, Clinical Operations Manager, System VP of Finance, Strategic Sourcing Director, Population Health Director

**Community Hospitals:** CEO & Medical Director, Chief Nursing Officer, Practice & IT Manager, Revenue Cycle Director, Clinical Operations Manager

**Private/Specialty Institutes:** Founder/CEO, Medical Director & Clinical Ops, Practice & IT Manager, Financial & Revenue Manager, EP Power User/Clinical Lead

**Cross-Segment:** Remote Monitoring Nurse, Regulatory Affairs/Compliance Manager, Clinical Educator/Training Lead

## What the Plan Will Do

I will create **one comprehensive primary ICP** in LaunchPulse using all the rich data from the playbook, populating every available field in your `icp_profiles` table. This will be the most detailed ICP in your system.

### ICP Fields to Populate

| Field | Value from Playbook |
|-------|-------------------|
| **name** | 91.Life Heart+ - Hospital & Health System ICP |
| **description** | Full description from the playbook covering all 4 segments |
| **industries** | Healthcare, Hospital & Health Systems, Medical Devices, Health IT |
| **sub_industries** | Electrophysiology, Cardiology, Remote Patient Monitoring, Clinical IT, Population Health |
| **company_sizes** | 30, 50, 75, 100, 150, 300, 500, 900, 1000 (bed counts mapped to employee ranges) |
| **revenue_ranges** | $10M-$25M through $5B+ |
| **geographies** | United States (primary market) |
| **persona_job_titles** | All 20+ titles from the playbook (Division Chief EP, VP Digital Strategy, CISO, CMO, CNO, CEO, etc.) |
| **persona_seniority_levels** | C-Suite, VP, Director, Manager, Practitioner |
| **persona_departments** | Clinical/Medical, IT/Digital, Finance/Operations, Procurement/Supply Chain, Quality/Compliance, Nursing, Research |
| **persona_decision_roles** | Decision Maker, Influencer, Champion, End User, Budget Holder, Gatekeeper |
| **tech_stack** | Epic, Cerner, Meditech, NextGen, Mirth Connect, Splunk, Power BI, Tableau, ServiceNow, Databricks, SAP Ariba |
| **pain_points** | Data silos, manual reporting, fragmented vendor portals, compliance burden, alert fatigue, lack of analytics |
| **buying_signals** | EHR modernization, cloud migration, digital transformation, remote monitoring program launch, grant funding |
| **buying_triggers** | New EHR rollout, regulatory audit, readmission penalties, staffing shortages, acquisition of new sites |
| **competitive_landscape** | Vendor-specific monitoring portals, legacy analytics tools, manual spreadsheet workflows |
| **decision_process** | Multi-stakeholder: clinical champion + IT validation + finance approval + compliance sign-off |
| **budget_indicators** | Capital budget cycle, grant funding, CMS reimbursement changes, value-based care contracts |
| **vertical_filters** | Hospital segment types as filters |
| **weights** | Custom scoring weights emphasizing EHR integration, bed count, and cardiology focus |

### Apollo/Enrichment Alignment
The fields populated (especially **persona_job_titles**, **industries**, **company_sizes**, **tech_stack**, and **geographies**) directly map to Apollo's search filters, meaning:
- You can search Apollo for contacts matching these exact titles
- Company size and industry filters align with Apollo's database
- Tech stack entries (Epic, Cerner, etc.) can be used as Apollo technographic filters
- The ICP scoring engine will automatically score accounts against these criteria

### Implementation Steps

1. **Create the ICP via the `ai-actions-icp` edge function** with all fields populated from the playbook data
2. **Update the ICP record** with additional fields (pain_points, buying_signals, tech_stack, etc.) that go beyond what `create_icp` supports, using a direct database update
3. **Optionally create 4 child ICPs** (one per segment) linked via `parent_icp_id` for segment-specific scoring

### Technical Details

The `create_icp` action in the edge function only supports a subset of fields (name, description, industries, company_sizes, revenue_ranges, geographies, persona_titles). The remaining fields (tech_stack, pain_points, buying_signals, sub_industries, persona_seniority_levels, persona_departments, decision_process, competitive_landscape, etc.) will need a follow-up `update_icp` call or direct database insert to populate all 40+ columns in the `icp_profiles` table.

**Files to modify:**
- `supabase/functions/ai-actions-icp/index.ts` -- Expand `create_icp` action to accept and store all available ICP fields (tech_stack, pain_points, buying_signals, sub_industries, weights, vertical_filters, etc.)
- No new files needed -- uses existing infrastructure

