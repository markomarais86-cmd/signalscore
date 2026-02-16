

# Populate tech_stack and buying_signals on Active ICP Profile

## What needs to happen

This is a **data-only update** — no code changes required. The ICP Profile Summary Card already renders these sections; they just appear empty because the database fields are null/empty.

**Target record:** `Enterprise Technology & Data Infrastructure` (id: `d5c7eca2-66f9-4dd3-995d-e26fb8c3fe1d`, status: active)

## Data to insert

**tech_stack** (relevant to the "Enterprise Technology & Data Infrastructure" profile):
- Salesforce
- HubSpot
- Snowflake
- AWS
- Azure
- Google Cloud
- Kubernetes
- Terraform
- Databricks
- Tableau

**buying_signals** (common enterprise buying indicators):
- Recent funding round
- Leadership change
- Hiring surge in engineering
- Technology migration underway
- Contract renewal upcoming
- Expansion into new markets
- RFP issued
- Compliance deadline approaching

## How it will be done

A single SQL UPDATE using the Supabase insert tool to set both array columns on the active profile. No files are created or modified.

## Result

After the update, the ICP Profile Summary Card on the executive dashboard will show:
- **Tech Stack** section (Column 2, with Cpu icon) -- displays up to 5 tags + overflow
- **Buying Signals** section (Column 2, with TrendingUp icon) -- displays up to 4 tags + overflow

