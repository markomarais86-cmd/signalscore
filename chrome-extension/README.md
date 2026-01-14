# LaunchPulse LinkedIn Enricher - Chrome Extension

Capture company and contact data from LinkedIn and save directly to LaunchPulse.

## Features

- **Company Data Extraction**: Captures company name, domain, employee count, industry, and location from LinkedIn company pages
- **Person Data Extraction**: Captures name, title, company, and location from LinkedIn profiles
- **One-Click Save**: Save captured data directly to your LaunchPulse account
- **Auto-Enrichment**: When saving companies, automatically enriches with Firecrawl if domain is found

## Installation

### For Development

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this `chrome-extension` folder
5. The extension icon will appear in your browser toolbar

### Icons

You'll need to add icon files to the `icons/` folder:
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels  
- `icon128.png` - 128x128 pixels

You can create these from any square image or use a tool like https://icon.kitchen/

## Setup

1. Click the extension icon in your browser
2. Click the settings (gear) icon
3. Enter your LaunchPulse API key
   - Get this from LaunchPulse → Settings → API Keys
4. Click "Save Settings"

## Usage

1. Navigate to any LinkedIn company page (e.g., `linkedin.com/company/acme-corp`)
2. Click the LaunchPulse extension icon
3. View the extracted data
4. Click "Save to LaunchPulse"

Works the same for LinkedIn profile pages (`linkedin.com/in/john-doe`).

## API Key

To use this extension, you need an API key from LaunchPulse:

1. Log in to LaunchPulse
2. Go to Settings → API Keys
3. Create a new API key
4. Copy the key and paste it in the extension settings

## Supported LinkedIn Pages

- **Company pages**: `linkedin.com/company/*`
- **Profile pages**: `linkedin.com/in/*`

## Data Captured

### Companies
- Name
- Domain/Website
- Employee count (parsed from ranges like "1,001-5,000 employees")
- Industry
- City and Country
- LinkedIn URL

### People
- First and Last name
- Job title
- Current company
- Location
- LinkedIn URL

## Troubleshooting

**"Please configure your API key first"**
- Open extension settings and enter your LaunchPulse API key

**"Invalid or inactive API key"**  
- Check that your API key is correct and active in LaunchPulse

**Data not extracting correctly**
- LinkedIn's HTML structure changes occasionally
- Make sure you're on a company (`/company/`) or profile (`/in/`) page
- Try refreshing the page

## Privacy

This extension:
- Only runs on LinkedIn pages
- Does not collect any data unless you click "Save"
- Stores your API key locally in Chrome's sync storage
- Only sends data to your LaunchPulse account
