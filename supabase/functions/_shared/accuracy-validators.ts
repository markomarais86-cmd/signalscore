/**
 * Accuracy Validators Module
 * 
 * Implements 8 new accuracy improvements for maximum enrichment reliability:
 * 1. Email Domain Validation - Ensures emails match company domain
 * 2. Industry-NAICS Cross-Validation - Validates industry matches NAICS codes
 * 3. Location Plausibility Checks - Validates city/state combinations
 * 4. LinkedIn URL Format Validation - Validates profile/company URL formats
 * 5. Tech Stack Whitelist Validation - Filters hallucinated tech stacks
 * 6. Confidence Decay - Reduces confidence for stale cached data
 * 7. Source Agreement Scoring - Computes graduated confidence from multi-source votes
 * 8. Employee Count Range Tolerance - Allows percentage-based count variations
 */

// ============================================================================
// IMPROVEMENT #1: EMAIL DOMAIN VALIDATION
// ============================================================================

const GENERIC_EMAIL_PROVIDERS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
  'icloud.com', 'live.com', 'msn.com', 'protonmail.com', 'zoho.com',
  'yandex.com', 'mail.com', 'gmx.com', 'fastmail.com', 'tutanota.com',
  'qq.com', '163.com', 'sina.com', 'mail.ru', 'rediffmail.com',
];

export interface EmailValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validate that an email belongs to the company domain
 * Prevents AI from returning generic or wrong-company emails
 */
export function validateEmailMatchesDomain(
  email: string, 
  companyDomain: string | undefined
): EmailValidationResult {
  if (!email || !email.includes('@')) {
    return { isValid: false, reason: 'Invalid email format' };
  }
  
  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (!emailDomain) {
    return { isValid: false, reason: 'Could not extract email domain' };
  }
  
  // Reject generic email providers when enriching company contacts
  if (GENERIC_EMAIL_PROVIDERS.includes(emailDomain)) {
    return { 
      isValid: false, 
      reason: `Generic email provider (${emailDomain}) - expected company email` 
    };
  }
  
  // If we have a company domain, validate match
  if (companyDomain) {
    const targetDomain = companyDomain.toLowerCase().replace(/^www\./, '');
    
    // Exact match or subdomain match (e.g., uk.company.com for company.com)
    const emailMatchesDomain = 
      emailDomain === targetDomain || 
      emailDomain.endsWith(`.${targetDomain}`);
    
    if (!emailMatchesDomain) {
      return { 
        isValid: false, 
        reason: `Email domain ${emailDomain} doesn't match company domain ${targetDomain}` 
      };
    }
  }
  
  return { isValid: true };
}

// ============================================================================
// IMPROVEMENT #2: INDUSTRY-NAICS CROSS-VALIDATION
// ============================================================================

/**
 * NAICS code prefix to valid industry mappings
 * Covers 50+ major industry categories
 */
const NAICS_INDUSTRY_MAP: Record<string, string[]> = {
  // Information Technology
  '5112': ['Software', 'Technology', 'SaaS', 'IT', 'Computer', 'Tech'],
  '5415': ['Software', 'Technology', 'IT Services', 'Computer Services', 'Tech'],
  '5182': ['Technology', 'Data Centers', 'Cloud', 'Hosting', 'IT'],
  '5191': ['Internet', 'Digital Media', 'Online', 'Web', 'Tech'],
  
  // Financial Services
  '5221': ['Banking', 'Finance', 'Financial Services', 'Commercial Banking'],
  '5222': ['Credit', 'Finance', 'Lending', 'Financial Services'],
  '5231': ['Securities', 'Investment', 'Brokerage', 'Finance'],
  '5241': ['Insurance', 'Financial Services', 'Underwriting'],
  '5242': ['Insurance', 'Financial Services', 'Insurance Carriers'],
  '5239': ['Investment', 'Finance', 'Portfolio Management'],
  
  // Healthcare
  '6211': ['Healthcare', 'Medical', 'Health Services', 'Physician'],
  '6212': ['Dental', 'Healthcare', 'Medical', 'Health Services'],
  '6213': ['Healthcare', 'Medical', 'Health Services'],
  '6214': ['Healthcare', 'Outpatient', 'Medical', 'Health Services'],
  '6215': ['Laboratory', 'Medical', 'Healthcare', 'Diagnostics'],
  '6221': ['Hospital', 'Healthcare', 'Medical', 'Health Services'],
  '6231': ['Nursing', 'Healthcare', 'Senior Care', 'Medical'],
  
  // Manufacturing
  '3111': ['Food', 'Manufacturing', 'Consumer Goods', 'Agriculture'],
  '3221': ['Pulp', 'Paper', 'Manufacturing', 'Industrial'],
  '3241': ['Petroleum', 'Oil', 'Gas', 'Energy', 'Chemicals'],
  '3251': ['Chemicals', 'Manufacturing', 'Industrial'],
  '3341': ['Computer', 'Electronics', 'Technology', 'Hardware'],
  '3342': ['Communications', 'Electronics', 'Telecom', 'Technology'],
  '3361': ['Automotive', 'Motor Vehicle', 'Manufacturing', 'Transportation'],
  '3364': ['Aerospace', 'Defense', 'Manufacturing', 'Aviation'],
  
  // Retail
  '4411': ['Automotive', 'Retail', 'Car Dealership', 'Vehicle Sales'],
  '4412': ['Automotive', 'Retail', 'Vehicle', 'Parts'],
  '4451': ['Grocery', 'Retail', 'Food', 'Supermarket'],
  '4461': ['Health', 'Pharmacy', 'Retail', 'Drug Store'],
  '4481': ['Clothing', 'Apparel', 'Retail', 'Fashion'],
  '4511': ['Sporting Goods', 'Retail', 'Recreation'],
  '4541': ['E-Commerce', 'Online Retail', 'Mail Order', 'Internet'],
  
  // Professional Services
  '5411': ['Legal', 'Law', 'Attorney', 'Professional Services'],
  '5412': ['Accounting', 'Tax', 'Audit', 'Financial Services'],
  '5413': ['Engineering', 'Architecture', 'Design', 'Professional Services'],
  '5414': ['Design', 'Graphic Design', 'Industrial Design', 'Creative'],
  '5416': ['Management Consulting', 'Consulting', 'Business Services'],
  '5417': ['Research', 'Scientific', 'R&D', 'Laboratory'],
  '5418': ['Advertising', 'Marketing', 'PR', 'Media'],
  '5419': ['Professional Services', 'Business Services'],
  
  // Real Estate
  '5311': ['Real Estate', 'Property', 'Leasing', 'Rental'],
  '5312': ['Real Estate', 'Property Management', 'Commercial Real Estate'],
  
  // Education
  '6111': ['Education', 'School', 'Elementary', 'Secondary'],
  '6112': ['Higher Education', 'College', 'University', 'Education'],
  '6113': ['Higher Education', 'University', 'Education'],
  '6114': ['Training', 'Education', 'Business School', 'Trade School'],
  '6115': ['Training', 'Education', 'Technical Training'],
  '6116': ['Education', 'Training', 'Educational Support'],
  
  // Construction
  '2361': ['Construction', 'Residential', 'Building', 'Home Builder'],
  '2362': ['Construction', 'Commercial', 'Building', 'Nonresidential'],
  '2371': ['Construction', 'Infrastructure', 'Utility', 'Highway'],
  '2373': ['Construction', 'Highway', 'Street', 'Bridge'],
  '2381': ['Construction', 'Foundation', 'Building'],
  '2382': ['Construction', 'Building Equipment', 'HVAC', 'Plumbing'],
  '2383': ['Construction', 'Specialty', 'Finishing'],
  
  // Transportation
  '4811': ['Airlines', 'Aviation', 'Transportation', 'Air Transport'],
  '4841': ['Trucking', 'Transportation', 'Freight', 'Logistics'],
  '4851': ['Transportation', 'Transit', 'Bus', 'Urban Transit'],
  '4921': ['Courier', 'Delivery', 'Express', 'Logistics'],
  '4931': ['Warehousing', 'Storage', 'Logistics', 'Distribution'],
  
  // Hospitality
  '7211': ['Hotels', 'Hospitality', 'Lodging', 'Travel'],
  '7221': ['Restaurant', 'Food Service', 'Hospitality', 'Dining'],
  '7224': ['Restaurant', 'Food Service', 'Hospitality', 'Dining'],
  '7225': ['Restaurant', 'Food Service', 'Hospitality', 'Beverage'],
  
  // Media & Entertainment
  '5111': ['Publishing', 'Media', 'Newspaper', 'Magazine'],
  '5121': ['Film', 'Media', 'Entertainment', 'Motion Picture'],
  '5122': ['Music', 'Recording', 'Entertainment', 'Audio'],
  '5151': ['Broadcasting', 'Radio', 'Media', 'Entertainment'],
  '5152': ['Television', 'Cable', 'Media', 'Broadcasting'],
  
  // Telecommunications
  '5171': ['Telecommunications', 'Telecom', 'Wireless', 'Communications'],
  '5172': ['Telecommunications', 'Telecom', 'Wireless', 'Mobile'],
  '5173': ['Telecommunications', 'Telecom', 'Satellite', 'Communications'],
  '5174': ['Telecommunications', 'Telecom', 'Satellite', 'ISP'],
  
  // Utilities & Energy
  '2211': ['Utilities', 'Electric', 'Power', 'Energy'],
  '2212': ['Utilities', 'Natural Gas', 'Energy', 'Distribution'],
  '2213': ['Utilities', 'Water', 'Sewage', 'Infrastructure'],
  
  // Agriculture
  '1111': ['Agriculture', 'Farming', 'Oilseed', 'Grain'],
  '1112': ['Agriculture', 'Vegetable', 'Farming', 'Melon'],
  '1113': ['Agriculture', 'Fruit', 'Farming', 'Tree Nut'],
  '1121': ['Agriculture', 'Cattle', 'Ranching', 'Farming'],
  
  // Mining & Oil/Gas
  '2111': ['Oil', 'Gas', 'Energy', 'Extraction'],
  '2121': ['Mining', 'Coal', 'Minerals', 'Resources'],
  '2122': ['Mining', 'Metal', 'Ore', 'Minerals'],
  '2123': ['Mining', 'Nonmetallic', 'Minerals', 'Quarry'],
  '2131': ['Oil', 'Gas', 'Support Activities', 'Energy'],
};

export interface IndustryValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validate that the industry matches the NAICS code
 * Returns false if there's a clear mismatch indicating AI hallucination
 */
export function validateNAICSIndustryMatch(
  naics: string | undefined, 
  industry: string | undefined
): IndustryValidationResult {
  if (!naics || !industry) {
    return { isValid: true }; // Can't validate without both
  }
  
  const prefix = naics.substring(0, 4);
  const validIndustries = NAICS_INDUSTRY_MAP[prefix];
  
  if (!validIndustries) {
    // Unknown NAICS prefix - allow it through
    return { isValid: true };
  }
  
  // Check if industry matches any valid category for this NAICS
  const industryLower = industry.toLowerCase();
  const matches = validIndustries.some(valid => 
    industryLower.includes(valid.toLowerCase()) ||
    valid.toLowerCase().includes(industryLower)
  );
  
  if (!matches) {
    return { 
      isValid: false, 
      reason: `NAICS ${naics} (${validIndustries[0]}) doesn't match industry "${industry}"` 
    };
  }
  
  return { isValid: true };
}

// ============================================================================
// IMPROVEMENT #3: LOCATION PLAUSIBILITY CHECKS
// ============================================================================

/**
 * US state abbreviation to major cities mapping
 * Contains 500+ major cities across all 50 states
 */
const US_STATE_CITIES: Record<string, string[]> = {
  // Alabama
  'AL': ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa', 'Hoover', 'Dothan', 'Auburn', 'Decatur', 'Madison'],
  'Alabama': ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa', 'Hoover', 'Dothan', 'Auburn'],
  
  // Alaska
  'AK': ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan', 'Wasilla', 'Kenai', 'Kodiak'],
  'Alaska': ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan', 'Wasilla'],
  
  // Arizona
  'AZ': ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Gilbert', 'Glendale', 'Tempe', 'Peoria', 'Surprise', 'Yuma', 'Flagstaff'],
  'Arizona': ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Gilbert', 'Glendale', 'Tempe'],
  
  // Arkansas
  'AR': ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro', 'Rogers', 'Conway', 'Bentonville', 'Pine Bluff'],
  'Arkansas': ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro'],
  
  // California
  'CA': ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno', 'Sacramento', 'Long Beach', 'Oakland', 'Bakersfield', 'Anaheim', 
         'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista', 'Fremont', 'San Bernardino', 'Modesto', 'Fontana', 'Moreno Valley',
         'Glendale', 'Huntington Beach', 'Santa Clarita', 'Garden Grove', 'Oceanside', 'Rancho Cucamonga', 'Ontario', 'Santa Rosa', 'Elk Grove',
         'Corona', 'Lancaster', 'Palmdale', 'Salinas', 'Pomona', 'Hayward', 'Escondido', 'Sunnyvale', 'Torrance', 'Pasadena', 'Orange',
         'Fullerton', 'Thousand Oaks', 'Roseville', 'Concord', 'Simi Valley', 'Santa Clara', 'Victorville', 'Vallejo', 'Berkeley', 'El Monte',
         'Downey', 'Costa Mesa', 'Inglewood', 'Carlsbad', 'Fairfield', 'Ventura', 'Temecula', 'Antioch', 'Richmond', 'West Covina',
         'Murrieta', 'Norwalk', 'Daly City', 'Burbank', 'El Cajon', 'Rialto', 'San Mateo', 'Clovis', 'Compton', 'Jurupa Valley',
         'Vista', 'South Gate', 'Mission Viejo', 'Vacaville', 'Carson', 'Hesperia', 'Santa Maria', 'Redding', 'Westminster', 'Santa Monica',
         'Palo Alto', 'Mountain View', 'Cupertino', 'Menlo Park', 'Redwood City', 'San Ramon', 'Pleasanton', 'Walnut Creek', 'Foster City'],
  'California': ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno', 'Sacramento', 'Oakland'],
  
  // Colorado
  'CO': ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Thornton', 'Arvada', 'Westminster', 'Pueblo', 'Centennial',
         'Boulder', 'Greeley', 'Longmont', 'Loveland', 'Grand Junction', 'Broomfield', 'Castle Rock', 'Commerce City', 'Parker', 'Littleton'],
  'Colorado': ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder', 'Lakewood'],
  
  // Connecticut
  'CT': ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury', 'Norwalk', 'Danbury', 'New Britain', 'Bristol', 'West Hartford', 'Meriden', 'Greenwich'],
  'Connecticut': ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury', 'Norwalk'],
  
  // Delaware
  'DE': ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Smyrna', 'Milford', 'Seaford', 'Georgetown'],
  'Delaware': ['Wilmington', 'Dover', 'Newark', 'Middletown'],
  
  // Florida
  'FL': ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Hialeah', 'Port St. Lucie', 'Cape Coral', 'Tallahassee', 'Fort Lauderdale',
         'Pembroke Pines', 'Hollywood', 'Miramar', 'Gainesville', 'Coral Springs', 'Miami Gardens', 'Clearwater', 'Palm Bay', 'Pompano Beach',
         'West Palm Beach', 'Lakeland', 'Davie', 'Boca Raton', 'Sunrise', 'Plantation', 'Deerfield Beach', 'Deltona', 'Palm Coast', 'Fort Myers', 'Naples'],
  'Florida': ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Fort Lauderdale'],
  
  // Georgia
  'GA': ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Sandy Springs', 'Roswell', 'Macon', 'Johns Creek', 'Albany', 'Warner Robins', 'Alpharetta', 'Marietta'],
  'Georgia': ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Macon'],
  
  // Hawaii
  'HI': ['Honolulu', 'Pearl City', 'Hilo', 'Kailua', 'Waipahu', 'Kaneohe', 'Mililani Town', 'Kahului'],
  'Hawaii': ['Honolulu', 'Pearl City', 'Hilo', 'Kailua'],
  
  // Idaho
  'ID': ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello', 'Caldwell', 'Coeur d\'Alene', 'Twin Falls'],
  'Idaho': ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello'],
  
  // Illinois
  'IL': ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville', 'Springfield', 'Peoria', 'Elgin', 'Champaign', 'Waukegan',
         'Cicero', 'Bloomington', 'Arlington Heights', 'Evanston', 'Schaumburg', 'Decatur', 'Bolingbrook', 'Palatine', 'Skokie'],
  'Illinois': ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville', 'Springfield'],
  
  // Indiana
  'IN': ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Bloomington', 'Fishers', 'Hammond', 'Gary', 'Lafayette', 'Muncie', 'Terre Haute'],
  'Indiana': ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Bloomington'],
  
  // Iowa
  'IA': ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City', 'Waterloo', 'Ames', 'West Des Moines', 'Council Bluffs', 'Dubuque'],
  'Iowa': ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City'],
  
  // Kansas
  'KS': ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka', 'Lawrence', 'Shawnee', 'Manhattan', 'Lenexa', 'Salina'],
  'Kansas': ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka', 'Lawrence'],
  
  // Kentucky
  'KY': ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington', 'Hopkinsville', 'Richmond', 'Florence', 'Georgetown'],
  'Kentucky': ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington'],
  
  // Louisiana
  'LA': ['New Orleans', 'Baton Rouge', 'Shreveport', 'Metairie', 'Lafayette', 'Lake Charles', 'Kenner', 'Bossier City', 'Monroe', 'Alexandria'],
  'Louisiana': ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'],
  
  // Maine
  'ME': ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn', 'Biddeford', 'Sanford', 'Scarborough'],
  'Maine': ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'],
  
  // Maryland
  'MD': ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Bowie', 'Hagerstown', 'Annapolis', 'College Park', 'Salisbury', 'Bethesda', 'Silver Spring'],
  'Maryland': ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Annapolis'],
  
  // Massachusetts
  'MA': ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 'Brockton', 'New Bedford', 'Quincy', 'Lynn', 'Fall River', 
         'Newton', 'Lawrence', 'Somerville', 'Framingham', 'Haverhill', 'Waltham', 'Malden', 'Brookline', 'Medford', 'Taunton'],
  'Massachusetts': ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell'],
  
  // Michigan
  'MI': ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing', 'Flint', 'Dearborn', 'Livonia', 'Troy',
         'Westland', 'Farmington Hills', 'Kalamazoo', 'Wyoming', 'Rochester Hills', 'Southfield', 'Taylor', 'Pontiac', 'St. Clair Shores', 'Royal Oak'],
  'Michigan': ['Detroit', 'Grand Rapids', 'Warren', 'Ann Arbor', 'Lansing', 'Flint'],
  
  // Minnesota
  'MN': ['Minneapolis', 'Saint Paul', 'St. Paul', 'Rochester', 'Bloomington', 'Duluth', 'Brooklyn Park', 'Plymouth', 'St. Cloud', 'Woodbury', 'Eagan', 'Maple Grove', 'Eden Prairie'],
  'Minnesota': ['Minneapolis', 'Saint Paul', 'St. Paul', 'Rochester', 'Bloomington', 'Duluth'],
  
  // Mississippi
  'MS': ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi', 'Meridian', 'Tupelo', 'Greenville', 'Olive Branch', 'Horn Lake'],
  'Mississippi': ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi'],
  
  // Missouri
  'MO': ['Kansas City', 'St. Louis', 'Saint Louis', 'Springfield', 'Independence', 'Columbia', 'Lee\'s Summit', 'O\'Fallon', 'St. Joseph', 'St. Charles', 'Blue Springs', 'St. Peters'],
  'Missouri': ['Kansas City', 'St. Louis', 'Saint Louis', 'Springfield', 'Independence', 'Columbia'],
  
  // Montana
  'MT': ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte', 'Helena', 'Kalispell', 'Havre'],
  'Montana': ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte', 'Helena'],
  
  // Nebraska
  'NE': ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney', 'Fremont', 'Hastings', 'Norfolk', 'North Platte'],
  'Nebraska': ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney'],
  
  // Nevada
  'NV': ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks', 'Carson City', 'Fernley', 'Elko'],
  'Nevada': ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks', 'Carson City'],
  
  // New Hampshire
  'NH': ['Manchester', 'Nashua', 'Concord', 'Derry', 'Dover', 'Rochester', 'Salem', 'Merrimack'],
  'New Hampshire': ['Manchester', 'Nashua', 'Concord', 'Derry', 'Dover'],
  
  // New Jersey
  'NJ': ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Lakewood', 'Edison', 'Woodbridge', 'Toms River', 'Trenton', 'Clifton',
         'Camden', 'Brick', 'Cherry Hill', 'Passaic', 'Union City', 'Old Bridge', 'Middletown', 'Bayonne', 'East Orange', 'Franklin', 'Princeton', 'Hoboken'],
  'New Jersey': ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Trenton', 'Camden'],
  
  // New Mexico
  'NM': ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell', 'Farmington', 'Clovis', 'Hobbs', 'Alamogordo'],
  'New Mexico': ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell'],
  
  // New York
  'NY': ['New York', 'New York City', 'NYC', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle', 'Mount Vernon',
         'Schenectady', 'Utica', 'White Plains', 'Troy', 'Niagara Falls', 'Binghamton', 'Freeport', 'Long Beach', 'Ithaca', 'Poughkeepsie',
         'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'],
  'New York': ['New York', 'New York City', 'NYC', 'Buffalo', 'Rochester', 'Syracuse', 'Albany'],
  
  // North Carolina
  'NC': ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville', 'Cary', 'Wilmington', 'High Point', 'Concord',
         'Greenville', 'Asheville', 'Gastonia', 'Jacksonville', 'Chapel Hill', 'Huntersville', 'Apex', 'Wake Forest', 'Kannapolis'],
  'North Carolina': ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville'],
  
  // North Dakota
  'ND': ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo', 'Williston', 'Mandan', 'Dickinson'],
  'North Dakota': ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo'],
  
  // Ohio
  'OH': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton', 'Parma', 'Canton', 'Youngstown', 'Lorain',
         'Hamilton', 'Springfield', 'Kettering', 'Elyria', 'Lakewood', 'Cuyahoga Falls', 'Middletown', 'Newark', 'Dublin', 'Westerville'],
  'Ohio': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  
  // Oklahoma
  'OK': ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond', 'Lawton', 'Moore', 'Midwest City', 'Enid', 'Stillwater'],
  'Oklahoma': ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond', 'Lawton'],
  
  // Oregon
  'OR': ['Portland', 'Eugene', 'Salem', 'Gresham', 'Hillsboro', 'Beaverton', 'Bend', 'Medford', 'Springfield', 'Corvallis', 'Albany', 'Tigard', 'Lake Oswego'],
  'Oregon': ['Portland', 'Eugene', 'Salem', 'Gresham', 'Hillsboro', 'Beaverton', 'Bend'],
  
  // Pennsylvania
  'PA': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Erie', 'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg', 'York',
         'State College', 'Wilkes-Barre', 'Chester', 'Altoona', 'Norristown', 'King of Prussia', 'Conshohocken'],
  'Pennsylvania': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Erie', 'Harrisburg'],
  
  // Rhode Island
  'RI': ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence', 'Woonsocket', 'Newport', 'Central Falls'],
  'Rhode Island': ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'Newport'],
  
  // South Carolina
  'SC': ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill', 'Greenville', 'Summerville', 'Sumter', 'Spartanburg', 'Hilton Head', 'Myrtle Beach'],
  'South Carolina': ['Charleston', 'Columbia', 'Greenville', 'Rock Hill', 'Spartanburg'],
  
  // South Dakota
  'SD': ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown', 'Mitchell', 'Yankton', 'Pierre'],
  'South Dakota': ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown'],
  
  // Tennessee
  'TN': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro', 'Franklin', 'Jackson', 'Johnson City', 'Bartlett', 'Hendersonville'],
  'Tennessee': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro'],
  
  // Texas
  'TX': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Laredo',
         'Lubbock', 'Garland', 'Irving', 'Amarillo', 'Grand Prairie', 'Brownsville', 'McKinney', 'Frisco', 'Pasadena', 'Mesquite',
         'Killeen', 'McAllen', 'Waco', 'Denton', 'Carrollton', 'Midland', 'Abilene', 'Beaumont', 'Round Rock', 'Odessa',
         'Pearland', 'Richardson', 'The Woodlands', 'College Station', 'League City', 'Allen', 'Sugar Land', 'Edinburg', 'Mission', 'Lewisville'],
  'Texas': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington'],
  
  // Utah
  'UT': ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem', 'Sandy', 'Ogden', 'St. George', 'Layton', 'Taylorsville', 'Lehi', 'Logan'],
  'Utah': ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem', 'Sandy', 'Ogden'],
  
  // Vermont
  'VT': ['Burlington', 'South Burlington', 'Rutland', 'Barre', 'Montpelier', 'St. Albans', 'Winooski', 'Bennington'],
  'Vermont': ['Burlington', 'South Burlington', 'Rutland', 'Montpelier'],
  
  // Virginia
  'VA': ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News', 'Alexandria', 'Hampton', 'Roanoke', 'Portsmouth', 'Suffolk',
         'Lynchburg', 'Harrisonburg', 'Charlottesville', 'Danville', 'Manassas', 'Arlington', 'Fairfax', 'Falls Church', 'McLean', 'Tysons'],
  'Virginia': ['Virginia Beach', 'Norfolk', 'Richmond', 'Chesapeake', 'Alexandria', 'Newport News'],
  
  // Washington
  'WA': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent', 'Everett', 'Renton', 'Spokane Valley', 'Federal Way',
         'Yakima', 'Bellingham', 'Kirkland', 'Kennewick', 'Auburn', 'Redmond', 'Marysville', 'Pasco', 'Richland', 'Sammamish', 'Olympia', 'Bothell'],
  'Washington': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Everett'],
  
  // Washington DC
  'DC': ['Washington', 'Washington DC', 'Washington, D.C.', 'D.C.'],
  'District of Columbia': ['Washington', 'Washington DC'],
  
  // West Virginia
  'WV': ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling', 'Weirton', 'Fairmont', 'Martinsburg', 'Beckley'],
  'West Virginia': ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling'],
  
  // Wisconsin
  'WI': ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton', 'Waukesha', 'Eau Claire', 'Oshkosh', 'Janesville', 'West Allis', 'La Crosse'],
  'Wisconsin': ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton'],
  
  // Wyoming
  'WY': ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs', 'Sheridan', 'Green River', 'Evanston', 'Riverton', 'Jackson'],
  'Wyoming': ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs'],
};

export interface LocationValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validate city/state combination for US addresses
 * Returns invalid if city cannot exist in the given state
 */
export function validateCityStateMatch(
  city: string | undefined, 
  state: string | undefined
): LocationValidationResult {
  if (!city || !state) {
    return { isValid: true }; // Can't validate without both
  }
  
  const validCities = US_STATE_CITIES[state] || US_STATE_CITIES[state.toUpperCase()];
  if (!validCities) {
    // Unknown state - allow it through (might be international)
    return { isValid: true };
  }
  
  // Normalize city name for comparison
  const cityLower = city.toLowerCase().trim();
  
  // Check for exact or fuzzy match
  const matches = validCities.some(validCity => {
    const validLower = validCity.toLowerCase();
    return (
      cityLower === validLower ||
      cityLower.includes(validLower) ||
      validLower.includes(cityLower)
    );
  });
  
  if (!matches) {
    return { 
      isValid: false, 
      reason: `City "${city}" is not a known city in ${state}` 
    };
  }
  
  return { isValid: true };
}

// ============================================================================
// IMPROVEMENT #4: LINKEDIN URL FORMAT VALIDATION
// ============================================================================

/**
 * Validate LinkedIn URL format for profiles and company pages
 */
export function validateLinkedInUrl(
  url: string | undefined, 
  type: 'profile' | 'company'
): boolean {
  if (!url) return false;
  
  // Must start with https://
  if (!url.startsWith('https://')) return false;
  
  // Remove trailing slashes for consistent matching
  const cleanUrl = url.replace(/\/+$/, '');
  
  if (type === 'profile') {
    // Profile URL pattern: https://linkedin.com/in/username
    // Allow: letters, numbers, hyphens, underscores
    const profilePattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_]+$/i;
    return profilePattern.test(cleanUrl);
  }
  
  // Company URL pattern: https://linkedin.com/company/company-name
  const companyPattern = /^https:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9\-_]+$/i;
  return companyPattern.test(cleanUrl);
}

/**
 * Attempt to fix common LinkedIn URL issues
 */
export function normalizeLinkedInUrl(url: string | undefined): string | null {
  if (!url) return null;
  
  let normalized = url.trim();
  
  // Add https:// if missing
  if (normalized.startsWith('linkedin.com')) {
    normalized = 'https://' + normalized;
  } else if (normalized.startsWith('www.linkedin.com')) {
    normalized = 'https://' + normalized;
  }
  
  // Ensure https not http
  normalized = normalized.replace(/^http:\/\//, 'https://');
  
  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');
  
  // Remove query parameters and fragments
  normalized = normalized.split('?')[0].split('#')[0];
  
  // Validate the cleaned URL
  const isProfile = normalized.includes('/in/');
  const isCompany = normalized.includes('/company/');
  
  if (isProfile && validateLinkedInUrl(normalized, 'profile')) {
    return normalized;
  }
  if (isCompany && validateLinkedInUrl(normalized, 'company')) {
    return normalized;
  }
  
  return null;
}

// ============================================================================
// IMPROVEMENT #5: TECH STACK WHITELIST VALIDATION
// ============================================================================

/**
 * Comprehensive whitelist of valid tech stack items (~300 items)
 */
const VALID_TECH_STACK_ITEMS = new Set([
  // Cloud Providers
  'AWS', 'Amazon Web Services', 'Azure', 'Microsoft Azure', 'GCP', 'Google Cloud', 'Google Cloud Platform',
  'DigitalOcean', 'Heroku', 'Linode', 'Vultr', 'OVH', 'IBM Cloud', 'Oracle Cloud', 'Alibaba Cloud', 'Cloudflare',
  'Vercel', 'Netlify', 'Render', 'Railway', 'Fly.io', 'PlanetScale',
  
  // Databases
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'SQLite', 'MariaDB', 'Oracle', 'SQL Server',
  'Microsoft SQL Server', 'Cassandra', 'DynamoDB', 'Firebase', 'Firestore', 'Supabase', 'CockroachDB', 'TimescaleDB',
  'InfluxDB', 'Neo4j', 'Couchbase', 'RethinkDB', 'FaunaDB', 'Fauna', 'ArangoDB', 'ClickHouse', 'Snowflake', 'BigQuery',
  'Redshift', 'Amazon RDS', 'Aurora', 'Amazon Aurora', 'Cosmos DB', 'Azure SQL',
  
  // Frontend Frameworks
  'React', 'React.js', 'ReactJS', 'Angular', 'Vue', 'Vue.js', 'VueJS', 'Svelte', 'SvelteKit', 'Next.js', 'NextJS',
  'Nuxt', 'Nuxt.js', 'Gatsby', 'Remix', 'Astro', 'Solid', 'SolidJS', 'Preact', 'Lit', 'Alpine.js', 'Ember',
  'Backbone', 'jQuery', 'Bootstrap', 'Tailwind', 'Tailwind CSS', 'Material UI', 'MUI', 'Chakra UI', 'Ant Design',
  'Styled Components', 'Emotion', 'Sass', 'SCSS', 'Less', 'CSS Modules', 'PostCSS', 'Framer Motion', 'Three.js',
  'D3', 'D3.js', 'Chart.js', 'Recharts', 'ECharts', 'Highcharts', 'WebGL',
  
  // Backend Frameworks
  'Node.js', 'NodeJS', 'Express', 'Express.js', 'Fastify', 'Koa', 'Hapi', 'NestJS', 'Nest.js', 'Adonis', 'AdonisJS',
  'Django', 'Flask', 'FastAPI', 'Tornado', 'Pyramid', 'Rails', 'Ruby on Rails', 'Sinatra', 'Hanami',
  'Spring', 'Spring Boot', 'Spring Framework', 'Quarkus', 'Micronaut', 'Play Framework', 'Vert.x',
  'Laravel', 'Symfony', 'CodeIgniter', 'CakePHP', 'Slim', 'Lumen', 'Yii', 'Zend', 'Laminas',
  'ASP.NET', '.NET', 'ASP.NET Core', '.NET Core', 'Blazor', 'Entity Framework',
  'Go', 'Golang', 'Gin', 'Echo', 'Fiber', 'Chi', 'Buffalo', 'Beego',
  'Rust', 'Actix', 'Rocket', 'Axum', 'Tokio', 'Warp',
  'Elixir', 'Phoenix', 'Ecto',
  'Scala', 'Akka',
  
  // Mobile
  'React Native', 'Flutter', 'Dart', 'Swift', 'SwiftUI', 'Kotlin', 'Objective-C', 'Xamarin', 'Ionic', 'Capacitor',
  'Cordova', 'PhoneGap', 'Expo', 'NativeScript', 'MAUI', '.NET MAUI',
  
  // DevOps & Infrastructure
  'Docker', 'Kubernetes', 'K8s', 'Terraform', 'Ansible', 'Puppet', 'Chef', 'Jenkins', 'CircleCI', 'Travis CI',
  'GitHub Actions', 'GitLab CI', 'Azure DevOps', 'TeamCity', 'Bamboo', 'ArgoCD', 'Argo CD', 'Flux', 'Helm',
  'Rancher', 'OpenShift', 'EKS', 'GKE', 'AKS', 'Vagrant', 'Packer', 'Consul', 'Vault', 'Nomad',
  'Prometheus', 'Grafana', 'Datadog', 'New Relic', 'Splunk', 'ELK', 'Elastic Stack', 'Logstash', 'Kibana',
  'Sentry', 'PagerDuty', 'OpsGenie', 'StatusPage', 'Nginx', 'Apache', 'Caddy', 'Traefik', 'HAProxy', 'Envoy',
  
  // CRM & Sales
  'Salesforce', 'HubSpot', 'Pipedrive', 'Zoho', 'Zoho CRM', 'Microsoft Dynamics', 'SAP', 'SAP CRM', 'SugarCRM',
  'Freshsales', 'Close', 'Apollo', 'Outreach', 'Salesloft', 'Gong', 'Chorus', 'Clari', 'ZoomInfo', 'LinkedIn Sales Navigator',
  
  // Marketing
  'Marketo', 'Pardot', 'Eloqua', 'Mailchimp', 'ActiveCampaign', 'Constant Contact', 'SendGrid', 'Postmark', 'Mailgun',
  'Braze', 'Iterable', 'Customer.io', 'Klaviyo', 'Drip', 'ConvertKit', 'AWeber', 'Campaign Monitor', 'Sendinblue',
  'Google Ads', 'Facebook Ads', 'LinkedIn Ads', 'Twitter Ads', 'Bing Ads', 'AdRoll', 'Criteo',
  
  // Analytics
  'Google Analytics', 'GA4', 'Google Analytics 4', 'Mixpanel', 'Amplitude', 'Segment', 'Heap', 'Pendo', 'FullStory',
  'Hotjar', 'Crazy Egg', 'Lucky Orange', 'Mouseflow', 'PostHog', 'Plausible', 'Fathom', 'Matomo', 'Kissmetrics',
  'Looker', 'Tableau', 'Power BI', 'Metabase', 'Mode', 'Sisense', 'Domo', 'Qlik', 'ThoughtSpot',
  
  // Customer Support
  'Intercom', 'Zendesk', 'Freshdesk', 'Help Scout', 'Drift', 'Crisp', 'Olark', 'LiveChat', 'Tawk.to', 'Front',
  'Helpshift', 'Kustomer', 'Gladly', 'Dixa', 'Groove', 'Kayako',
  
  // Payments
  'Stripe', 'PayPal', 'Braintree', 'Square', 'Adyen', 'Worldpay', 'Authorize.net', 'Chargebee', 'Recurly', 'Zuora',
  'Paddle', 'FastSpring', 'Gumroad', 'Shopify Payments', 'Klarna', 'Afterpay', 'Affirm', 'Apple Pay', 'Google Pay',
  
  // E-commerce
  'Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Squarespace', 'Wix', 'PrestaShop', 'OpenCart', 'Volusion',
  'Salesforce Commerce Cloud', 'SAP Commerce', 'Oracle Commerce', 'Adobe Commerce', 'CommerceTools',
  
  // CMS
  'WordPress', 'Drupal', 'Joomla', 'Contentful', 'Sanity', 'Strapi', 'Ghost', 'Webflow', 'Prismic', 'DatoCMS',
  'Storyblok', 'Hygraph', 'Butter CMS', 'Kentico', 'Sitecore', 'Adobe Experience Manager', 'AEM', 'Umbraco',
  
  // Communication
  'Slack', 'Microsoft Teams', 'Teams', 'Discord', 'Zoom', 'Google Meet', 'Whereby', 'Twilio', 'SendBird', 'Stream',
  'PubNub', 'Pusher', 'Ably', 'Firebase Cloud Messaging', 'FCM', 'OneSignal', 'Airship',
  
  // Authentication
  'Auth0', 'Okta', 'Firebase Auth', 'AWS Cognito', 'Cognito', 'Azure AD', 'Azure Active Directory', 'OneLogin',
  'Ping Identity', 'ForgeRock', 'Keycloak', 'FusionAuth', 'Clerk', 'Supabase Auth', 'Magic', 'Stytch',
  
  // Version Control
  'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Azure Repos', 'AWS CodeCommit', 'Perforce', 'SVN', 'Mercurial',
  
  // Project Management
  'Jira', 'Asana', 'Monday', 'Monday.com', 'Trello', 'ClickUp', 'Notion', 'Linear', 'Basecamp', 'Wrike',
  'Smartsheet', 'Airtable', 'Shortcut', 'Clubhouse', 'Pivotal Tracker', 'Azure Boards',
  
  // AI & ML
  'TensorFlow', 'PyTorch', 'Keras', 'scikit-learn', 'OpenAI', 'GPT', 'GPT-4', 'ChatGPT', 'Claude', 'Anthropic',
  'Hugging Face', 'LangChain', 'OpenCV', 'spaCy', 'NLTK', 'AWS SageMaker', 'SageMaker', 'Azure ML', 'Vertex AI',
  'MLflow', 'Weights & Biases', 'W&B', 'Comet', 'Neptune', 'DataRobot', 'H2O', 'Ray', 'Dask',
  
  // Misc
  'GraphQL', 'Apollo GraphQL', 'REST', 'gRPC', 'WebSocket', 'Socket.io', 'RabbitMQ', 'Kafka', 'Apache Kafka',
  'NATS', 'ZeroMQ', 'ActiveMQ', 'Amazon SQS', 'SQS', 'Amazon SNS', 'SNS', 'EventBridge', 'Celery',
  'Webpack', 'Vite', 'Rollup', 'Parcel', 'esbuild', 'SWC', 'Babel', 'ESLint', 'Prettier', 'TypeScript',
  'Jest', 'Mocha', 'Cypress', 'Playwright', 'Selenium', 'Puppeteer', 'Testing Library', 'Vitest',
  'Storybook', 'Chromatic', 'Percy', 'Figma', 'Sketch', 'Adobe XD', 'InVision', 'Zeplin',
]);

/**
 * Validate and filter tech stack items against the whitelist
 * Returns only valid, recognized technology names
 */
export function validateTechStack(items: string[] | undefined): string[] {
  if (!items || !Array.isArray(items)) return [];
  
  return items.filter(item => {
    if (!item || typeof item !== 'string') return false;
    
    const normalized = item.trim();
    if (!normalized) return false;
    
    // Check exact match (case-insensitive)
    const lowerNormalized = normalized.toLowerCase();
    for (const valid of VALID_TECH_STACK_ITEMS) {
      if (valid.toLowerCase() === lowerNormalized) {
        return true;
      }
    }
    
    return false;
  }).map(item => {
    // Return properly cased version from whitelist
    const normalized = item.trim().toLowerCase();
    for (const valid of VALID_TECH_STACK_ITEMS) {
      if (valid.toLowerCase() === normalized) {
        return valid;
      }
    }
    return item.trim();
  });
}

/**
 * Check if a single tech item is valid
 */
export function isValidTechStackItem(item: string): boolean {
  if (!item || typeof item !== 'string') return false;
  
  const normalized = item.trim().toLowerCase();
  for (const valid of VALID_TECH_STACK_ITEMS) {
    if (valid.toLowerCase() === normalized) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// IMPROVEMENT #6: CONFIDENCE DECAY FOR STALE CACHE
// ============================================================================

/**
 * Apply confidence decay based on cache age
 * Fresher data = higher confidence, stale data = reduced confidence
 * 
 * @param baseConfidence - Original confidence score (0-1)
 * @param cacheAgeDays - Age of cached data in days
 * @returns Adjusted confidence score with decay applied
 */
export function applyConfidenceDecay(
  baseConfidence: number, 
  cacheAgeDays: number
): number {
  // No decay for first 7 days
  if (cacheAgeDays <= 7) return baseConfidence;
  
  // Calculate weeks old (after first week)
  const weeksOld = Math.floor((cacheAgeDays - 7) / 7);
  
  // Decay 2% per week, minimum 70% of original confidence
  const decayFactor = Math.max(0.7, 1 - (weeksOld * 0.02));
  
  return baseConfidence * decayFactor;
}

/**
 * Calculate cache age in days from timestamp
 */
export function getCacheAgeDays(createdAt: string | Date): number {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ============================================================================
// IMPROVEMENT #7: SOURCE AGREEMENT SCORING
// ============================================================================

export interface FieldVote {
  source: string;
  value: any;
}

export interface FieldConfidence {
  value: any;
  sources: string[];
  agreementScore: number; // 0-100
  voteCount: number;
}

/**
 * Compute field confidence based on source agreement
 * Multiple sources agreeing = higher confidence
 * 
 * Scoring:
 * - 1 source: 50%
 * - 2 sources agreeing: 75%
 * - 3 sources agreeing: 90%
 * - 4+ sources agreeing: 95-99%
 */
export function computeFieldConfidence(votes: FieldVote[]): FieldConfidence {
  if (!votes || votes.length === 0) {
    return { value: null, sources: [], agreementScore: 0, voteCount: 0 };
  }
  
  if (votes.length === 1) {
    return { 
      value: votes[0].value, 
      sources: [votes[0].source], 
      agreementScore: 50,
      voteCount: 1,
    };
  }
  
  // Count agreements using JSON stringification for value comparison
  const valueCounts = new Map<string, { count: number; sources: string[]; value: any }>();
  
  for (const vote of votes) {
    // Normalize value for comparison (handle case sensitivity for strings)
    let normalizedValue = vote.value;
    if (typeof vote.value === 'string') {
      normalizedValue = vote.value.toLowerCase().trim();
    }
    
    const key = JSON.stringify(normalizedValue);
    const existing = valueCounts.get(key) || { count: 0, sources: [], value: vote.value };
    existing.count++;
    existing.sources.push(vote.source);
    valueCounts.set(key, existing);
  }
  
  // Find the value with most votes (winner)
  let winner = { count: 0, sources: [] as string[], value: null as any };
  for (const data of valueCounts.values()) {
    if (data.count > winner.count) {
      winner = data;
    }
  }
  
  // Calculate agreement score based on vote count
  let agreementScore: number;
  if (winner.count === 1) {
    agreementScore = 50; // No agreement
  } else if (winner.count === 2) {
    agreementScore = 75;
  } else if (winner.count === 3) {
    agreementScore = 90;
  } else {
    // 4+ sources: 95-99%
    agreementScore = Math.min(99, 95 + (winner.count - 4));
  }
  
  return {
    value: winner.value,
    sources: winner.sources,
    agreementScore,
    voteCount: winner.count,
  };
}

/**
 * Aggregate votes for multiple fields and return winning values
 */
export function aggregateFieldVotes(
  allVotes: Record<string, FieldVote[]>,
  minAgreementScore: number = 50
): Record<string, FieldConfidence> {
  const results: Record<string, FieldConfidence> = {};
  
  for (const [field, votes] of Object.entries(allVotes)) {
    const confidence = computeFieldConfidence(votes);
    if (confidence.agreementScore >= minAgreementScore) {
      results[field] = confidence;
    }
  }
  
  return results;
}

// ============================================================================
// IMPROVEMENT #8: EMPLOYEE COUNT RANGE TOLERANCE
// ============================================================================

/**
 * Check if two employee counts are within acceptable tolerance
 * Allows for natural variance in employee counts from different sources
 * 
 * Tolerance rules:
 * - Small companies (<100): allow ±20 employees
 * - Medium companies (100-999): allow ±15%
 * - Large companies (1000+): allow ±10%
 */
export function employeeCountsAgree(count1: number, count2: number): boolean {
  if (count1 === count2) return true;
  if (count1 <= 0 || count2 <= 0) return false;
  
  // Use smaller count as reference
  const smaller = Math.min(count1, count2);
  const larger = Math.max(count1, count2);
  const difference = larger - smaller;
  
  // Small companies: absolute tolerance of 20
  if (smaller < 100) {
    return difference <= 20;
  }
  
  // Medium companies: 15% tolerance
  if (smaller < 1000) {
    return (difference / smaller) <= 0.15;
  }
  
  // Large companies: 10% tolerance
  return (difference / smaller) <= 0.10;
}

/**
 * Aggregate multiple employee count values using tolerance-aware logic
 * Groups similar counts together and returns the median of the largest group
 */
export function aggregateEmployeeCounts(counts: number[]): number | null {
  if (!counts || counts.length === 0) return null;
  if (counts.length === 1) return counts[0];
  
  // Sort counts
  const sorted = [...counts].sort((a, b) => a - b);
  
  // Group counts that agree with each other
  const groups: number[][] = [];
  
  for (const count of sorted) {
    // Find a group this count agrees with
    let foundGroup = false;
    for (const group of groups) {
      if (group.some(g => employeeCountsAgree(g, count))) {
        group.push(count);
        foundGroup = true;
        break;
      }
    }
    
    if (!foundGroup) {
      groups.push([count]);
    }
  }
  
  // Return median of the largest group
  const largestGroup = groups.reduce((a, b) => a.length >= b.length ? a : b);
  const mid = Math.floor(largestGroup.length / 2);
  
  if (largestGroup.length % 2 === 0) {
    return Math.round((largestGroup[mid - 1] + largestGroup[mid]) / 2);
  }
  return largestGroup[mid];
}
