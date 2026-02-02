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
 * City aliases for common abbreviations and nicknames
 * Enables matching "LA" to "Los Angeles", "NYC" to "New York", etc.
 */
const CITY_ALIASES: Record<string, string[]> = {
  // California
  'Los Angeles': ['LA', 'L.A.'],
  'San Francisco': ['SF', 'S.F.', 'Frisco', 'Bay Area'],
  
  // New York
  'New York': ['NYC', 'NY City', 'New York City', 'Manhattan'],
  
  // Nevada
  'Las Vegas': ['Vegas', 'LV'],
  
  // Pennsylvania
  'Philadelphia': ['Philly', 'PHL'],
  
  // Texas
  'Dallas': ['DFW', 'Big D'],
  'Houston': ['HTX', 'H-Town'],
  'San Antonio': ['SA', 'San Antone'],
  
  // Florida
  'Miami': ['MIA'],
  'Tampa': ['Tampa Bay'],
  
  // Illinois
  'Chicago': ['Chi-Town', 'CHI'],
  
  // District of Columbia
  'Washington': ['DC', 'D.C.', 'Washington DC', 'Washington D.C.'],
  
  // Massachusetts
  'Boston': ['Beantown'],
  
  // Georgia
  'Atlanta': ['ATL', 'Hotlanta'],
  
  // Arizona
  'Phoenix': ['PHX', 'The Valley'],
  
  // Colorado
  'Denver': ['Mile High City'],
  
  // Oregon
  'Portland': ['PDX', 'Stumptown'],
  
  // Washington
  'Seattle': ['SEA', 'Emerald City'],
  
  // Minnesota
  'Minneapolis': ['MPLS', 'Mill City'],
  'Saint Paul': ['St. Paul', 'St Paul'],
  
  // Missouri
  'Saint Louis': ['St. Louis', 'St Louis', 'STL'],
  
  // Louisiana
  'New Orleans': ['NOLA', 'The Big Easy'],
  
  // Tennessee
  'Nashville': ['Music City'],
  
  // Michigan
  'Detroit': ['Motor City', 'Motown'],
  
  // Kentucky
  'Louisville': ['Lou', 'Derby City'],
  
  // New Jersey
  'Atlantic City': ['AC'],
  
  // Ohio
  'Cincinnati': ['Cincy', 'The Nati'],
  'Cleveland': ['CLE', 'The Land'],
};

/**
 * US state abbreviation to major cities mapping
 * Contains 700+ cities across all 50 states including suburbs
 */
const US_STATE_CITIES: Record<string, string[]> = {
  // Alabama
  'AL': ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa', 'Hoover', 'Dothan', 'Auburn', 'Decatur', 'Madison',
         'Florence', 'Gadsden', 'Vestavia Hills', 'Prattville', 'Phenix City', 'Alabaster', 'Bessemer', 'Enterprise', 'Opelika', 'Homewood'],
  'Alabama': ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa', 'Hoover', 'Dothan', 'Auburn'],
  
  // Alaska - Enhanced coverage
  'AK': ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan', 'Wasilla', 'Kenai', 'Kodiak',
         'Palmer', 'North Pole', 'Seward', 'Homer', 'Valdez', 'Bethel', 'Nome', 'Barrow', 'Soldotna', 'Petersburg'],
  'Alaska': ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan', 'Wasilla'],
  
  // Arizona
  'AZ': ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Gilbert', 'Glendale', 'Tempe', 'Peoria', 'Surprise', 'Yuma', 'Flagstaff',
         'Goodyear', 'Avondale', 'Buckeye', 'Casa Grande', 'Lake Havasu City', 'Maricopa', 'Sierra Vista', 'Prescott', 'Apache Junction', 'Queen Creek'],
  'Arizona': ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Gilbert', 'Glendale', 'Tempe'],
  
  // Arkansas
  'AR': ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro', 'Rogers', 'Conway', 'Bentonville', 'Pine Bluff',
         'North Little Rock', 'Hot Springs', 'Benton', 'Texarkana', 'Sherwood', 'Jacksonville', 'Russellville', 'Bella Vista', 'West Memphis', 'Paragould', 'Cabot'],
  'Arkansas': ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro'],
  
  // California - Massively expanded with suburbs
  'CA': ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno', 'Sacramento', 'Long Beach', 'Oakland', 'Bakersfield', 'Anaheim', 
         'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista', 'Fremont', 'San Bernardino', 'Modesto', 'Fontana', 'Moreno Valley',
         'Glendale', 'Huntington Beach', 'Santa Clarita', 'Garden Grove', 'Oceanside', 'Rancho Cucamonga', 'Ontario', 'Santa Rosa', 'Elk Grove',
         'Corona', 'Lancaster', 'Palmdale', 'Salinas', 'Pomona', 'Hayward', 'Escondido', 'Sunnyvale', 'Torrance', 'Pasadena', 'Orange',
         'Fullerton', 'Thousand Oaks', 'Roseville', 'Concord', 'Simi Valley', 'Santa Clara', 'Victorville', 'Vallejo', 'Berkeley', 'El Monte',
         'Downey', 'Costa Mesa', 'Inglewood', 'Carlsbad', 'Fairfield', 'Ventura', 'Temecula', 'Antioch', 'Richmond', 'West Covina',
         'Murrieta', 'Norwalk', 'Daly City', 'Burbank', 'El Cajon', 'Rialto', 'San Mateo', 'Clovis', 'Compton', 'Jurupa Valley',
         'Vista', 'South Gate', 'Mission Viejo', 'Vacaville', 'Carson', 'Hesperia', 'Santa Maria', 'Redding', 'Westminster', 'Santa Monica',
         'Palo Alto', 'Mountain View', 'Cupertino', 'Menlo Park', 'Redwood City', 'San Ramon', 'Pleasanton', 'Walnut Creek', 'Foster City',
         // New additions - South Bay, Inland Empire, Beach Cities
         'Chico', 'Redlands', 'Arcadia', 'Whittier', 'Newport Beach', 'San Clemente', 'Laguna Beach', 'Hermosa Beach', 'Manhattan Beach',
         'Rancho Mirage', 'Palm Springs', 'Palm Desert', 'Indio', 'Coachella', 'Gilroy', 'Morgan Hill', 'Los Gatos', 'Saratoga', 'Campbell',
         'Millbrae', 'San Bruno', 'Pacifica', 'Half Moon Bay', 'Livermore', 'Dublin', 'San Leandro', 'Union City', 'Alameda', 'Emeryville',
         'Napa', 'Santa Cruz', 'Monterey', 'Carmel', 'San Luis Obispo', 'Santa Barbara', 'Oxnard', 'Camarillo', 'Solvang', 'Lompoc',
         'Petaluma', 'Novato', 'San Rafael', 'Mill Valley', 'Tiburon', 'Sausalito', 'Danville', 'Lafayette', 'Orinda', 'Moraga',
         'Cerritos', 'La Mirada', 'Lakewood', 'Paramount', 'Bellflower', 'Cypress', 'Buena Park', 'La Habra', 'Brea', 'Yorba Linda',
         'Lake Forest', 'Laguna Niguel', 'Aliso Viejo', 'Dana Point', 'San Juan Capistrano', 'Rancho Santa Margarita', 'Ladera Ranch'],
  'California': ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno', 'Sacramento', 'Oakland'],
  
  // Colorado - Enhanced with Front Range suburbs
  'CO': ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Thornton', 'Arvada', 'Westminster', 'Pueblo', 'Centennial',
         'Boulder', 'Greeley', 'Longmont', 'Loveland', 'Grand Junction', 'Broomfield', 'Castle Rock', 'Commerce City', 'Parker', 'Littleton',
         'Highlands Ranch', 'Northglenn', 'Brighton', 'Englewood', 'Wheat Ridge', 'Golden', 'Louisville', 'Lafayette', 'Erie', 'Superior',
         'Frederick', 'Firestone', 'Windsor', 'Durango', 'Steamboat Springs', 'Aspen', 'Vail', 'Breckenridge', 'Telluride', 'Glenwood Springs'],
  'Colorado': ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder', 'Lakewood'],
  
  // Connecticut - Enhanced coverage
  'CT': ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury', 'Norwalk', 'Danbury', 'New Britain', 'Bristol', 'West Hartford', 'Meriden', 'Greenwich',
         'Fairfield', 'Hamden', 'Manchester', 'East Hartford', 'Milford', 'Stratford', 'Middletown', 'Shelton', 'Norwich', 'Torrington',
         'Westport', 'Darien', 'New Canaan', 'Ridgefield', 'Wilton', 'Trumbull', 'Monroe', 'Newtown', 'Glastonbury', 'Farmington'],
  'Connecticut': ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury', 'Norwalk'],
  
  // Delaware - Enhanced coverage
  'DE': ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Smyrna', 'Milford', 'Seaford', 'Georgetown',
         'Lewes', 'Rehoboth Beach', 'Claymont', 'Elsmere', 'New Castle', 'Bear', 'Hockessin', 'Pike Creek', 'Brookside', 'Glasgow', 'Bethany Beach', 'Dewey Beach'],
  'Delaware': ['Wilmington', 'Dover', 'Newark', 'Middletown'],
  
  // Florida - Enhanced with suburban cities
  'FL': ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Hialeah', 'Port St. Lucie', 'Cape Coral', 'Tallahassee', 'Fort Lauderdale',
         'Pembroke Pines', 'Hollywood', 'Miramar', 'Gainesville', 'Coral Springs', 'Miami Gardens', 'Clearwater', 'Palm Bay', 'Pompano Beach',
         'West Palm Beach', 'Lakeland', 'Davie', 'Boca Raton', 'Sunrise', 'Plantation', 'Deerfield Beach', 'Deltona', 'Palm Coast', 'Fort Myers', 'Naples',
         'Sarasota', 'Bradenton', 'Melbourne', 'Kissimmee', 'Ocala', 'Daytona Beach', 'Pensacola', 'Panama City', 'Key West', 'Destin',
         'Aventura', 'Weston', 'Coral Gables', 'Miami Beach', 'Coconut Creek', 'Margate', 'Tamarac', 'Jupiter', 'Wellington', 'Royal Palm Beach',
         'Boynton Beach', 'Delray Beach', 'Lake Worth', 'Riviera Beach', 'Sanford', 'Winter Park', 'Oviedo', 'Winter Garden', 'Apopka', 'Clermont'],
  'Florida': ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Fort Lauderdale'],
  
  // Georgia - Enhanced with Atlanta suburbs
  'GA': ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Sandy Springs', 'Roswell', 'Macon', 'Johns Creek', 'Albany', 'Warner Robins', 'Alpharetta', 'Marietta',
         'Brookhaven', 'Smyrna', 'Dunwoody', 'Peachtree City', 'Kennesaw', 'Lawrenceville', 'Duluth', 'Gainesville', 'Woodstock', 'Canton', 'Newnan',
         'Carrollton', 'Griffin', 'Dalton', 'LaGrange', 'Rome', 'Valdosta', 'Statesboro', 'Brunswick', 'Douglasville', 'Acworth', 'Tucker', 'Decatur'],
  'Georgia': ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Macon'],
  
  // Hawaii - Enhanced coverage
  'HI': ['Honolulu', 'Pearl City', 'Hilo', 'Kailua', 'Waipahu', 'Kaneohe', 'Mililani Town', 'Kahului',
         'Kapolei', 'Ewa Beach', 'Lahaina', 'Kihei', 'Wailea', 'Kona', 'Kailua-Kona', 'Captain Cook', 'Waimea', 'Lihue', 'Poipu', 'Princeville'],
  'Hawaii': ['Honolulu', 'Pearl City', 'Hilo', 'Kailua'],
  
  // Idaho - Enhanced coverage
  'ID': ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello', 'Caldwell', 'Coeur d\'Alene', 'Twin Falls',
         'Post Falls', 'Lewiston', 'Rexburg', 'Moscow', 'Eagle', 'Kuna', 'Ammon', 'Chubbuck', 'Mountain Home', 'Sandpoint', 'Sun Valley', 'Ketchum'],
  'Idaho': ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello'],
  
  // Illinois - Enhanced with Chicago suburbs
  'IL': ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville', 'Springfield', 'Peoria', 'Elgin', 'Champaign', 'Waukegan',
         'Cicero', 'Bloomington', 'Arlington Heights', 'Evanston', 'Schaumburg', 'Decatur', 'Bolingbrook', 'Palatine', 'Skokie',
         'Des Plaines', 'Orland Park', 'Tinley Park', 'Oak Lawn', 'Berwyn', 'Mount Prospect', 'Normal', 'Oak Park', 'Downers Grove', 'Wheaton',
         'Elmhurst', 'Lombard', 'Buffalo Grove', 'Hoffman Estates', 'Glenview', 'Bartlett', 'Crystal Lake', 'Carol Stream', 'Romeoville', 'Plainfield',
         'Oswego', 'Lisle', 'Woodridge', 'Addison', 'Hanover Park', 'St. Charles', 'Geneva', 'Batavia', 'Lake Zurich', 'Vernon Hills'],
  'Illinois': ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville', 'Springfield'],
  
  // Indiana - Enhanced coverage
  'IN': ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Bloomington', 'Fishers', 'Hammond', 'Gary', 'Lafayette', 'Muncie', 'Terre Haute',
         'Noblesville', 'Westfield', 'Greenwood', 'Kokomo', 'Mishawaka', 'Lawrence', 'Jeffersonville', 'Anderson', 'Columbus', 'Elkhart',
         'Valparaiso', 'Portage', 'Crown Point', 'Schererville', 'Merrillville', 'Goshen', 'New Albany', 'Richmond', 'Zionsville', 'Avon'],
  'Indiana': ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Bloomington'],
  
  // Iowa - Enhanced coverage
  'IA': ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City', 'Waterloo', 'Ames', 'West Des Moines', 'Council Bluffs', 'Dubuque',
         'Ankeny', 'Urbandale', 'Bettendorf', 'Marion', 'Cedar Falls', 'Coralville', 'Johnston', 'Clinton', 'Mason City', 'Fort Dodge', 'Burlington', 'Ottumwa'],
  'Iowa': ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City'],
  
  // Kansas - Enhanced coverage
  'KS': ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka', 'Lawrence', 'Shawnee', 'Manhattan', 'Lenexa', 'Salina',
         'Hutchinson', 'Leavenworth', 'Leawood', 'Dodge City', 'Garden City', 'Emporia', 'Derby', 'Prairie Village', 'Hays', 'Liberal', 'Junction City', 'Pittsburg'],
  'Kansas': ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka', 'Lawrence'],
  
  // Kentucky - Enhanced coverage
  'KY': ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington', 'Hopkinsville', 'Richmond', 'Florence', 'Georgetown',
         'Elizabethtown', 'Nicholasville', 'Henderson', 'Frankfort', 'Paducah', 'Ashland', 'Radcliff', 'Murray', 'Danville', 'Erlanger', 'Burlington', 'Winchester', 'St. Matthews'],
  'Kentucky': ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington'],
  
  // Louisiana - Enhanced coverage
  'LA': ['New Orleans', 'Baton Rouge', 'Shreveport', 'Metairie', 'Lafayette', 'Lake Charles', 'Kenner', 'Bossier City', 'Monroe', 'Alexandria',
         'Houma', 'Marrero', 'New Iberia', 'Slidell', 'Central', 'Ruston', 'Hammond', 'Harvey', 'Natchitoches', 'Sulphur', 'Zachary', 'Mandeville', 'Covington'],
  'Louisiana': ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'],
  
  // Maine - Enhanced coverage
  'ME': ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn', 'Biddeford', 'Sanford', 'Scarborough',
         'Brunswick', 'Westbrook', 'Saco', 'Augusta', 'Waterville', 'Presque Isle', 'Gorham', 'Falmouth', 'Kennebunk', 'Kittery', 'Bar Harbor', 'Camden', 'Rockland'],
  'Maine': ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'],
  
  // Maryland - Enhanced with DC suburbs
  'MD': ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Bowie', 'Hagerstown', 'Annapolis', 'College Park', 'Salisbury', 'Bethesda', 'Silver Spring',
         'Columbia', 'Germantown', 'Waldorf', 'Glen Burnie', 'Ellicott City', 'Dundalk', 'Towson', 'Potomac', 'Aspen Hill', 'Wheaton', 'Catonsville',
         'Pikesville', 'Parkville', 'Randallstown', 'Severna Park', 'Laurel', 'Greenbelt', 'Takoma Park', 'Hyattsville', 'Chevy Chase', 'Kensington'],
  'Maryland': ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Annapolis'],
  
  // Massachusetts - Enhanced with Boston suburbs
  'MA': ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 'Brockton', 'New Bedford', 'Quincy', 'Lynn', 'Fall River', 
         'Newton', 'Lawrence', 'Somerville', 'Framingham', 'Haverhill', 'Waltham', 'Malden', 'Brookline', 'Medford', 'Taunton',
         'Plymouth', 'Weymouth', 'Peabody', 'Revere', 'Methuen', 'Barnstable', 'Pittsfield', 'Attleboro', 'Everett', 'Salem',
         'Beverly', 'Marlborough', 'Arlington', 'Watertown', 'Needham', 'Wellesley', 'Lexington', 'Concord', 'Natick', 'Dedham',
         'Burlington', 'Andover', 'Chelmsford', 'Billerica', 'Woburn', 'Reading', 'Wakefield', 'Stoneham', 'Norwood', 'Canton'],
  'Massachusetts': ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell'],
  
  // Michigan - Enhanced coverage
  'MI': ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing', 'Flint', 'Dearborn', 'Livonia', 'Troy',
         'Westland', 'Farmington Hills', 'Kalamazoo', 'Wyoming', 'Rochester Hills', 'Southfield', 'Taylor', 'Pontiac', 'St. Clair Shores', 'Royal Oak',
         'Novi', 'Canton', 'Waterford', 'Clinton Township', 'Shelby Township', 'Macomb Township', 'Battle Creek', 'Muskegon', 'Holland', 'Portage',
         'Saginaw', 'Bay City', 'Midland', 'East Lansing', 'Auburn Hills', 'Birmingham', 'Bloomfield Hills', 'Northville', 'Plymouth', 'Traverse City'],
  'Michigan': ['Detroit', 'Grand Rapids', 'Warren', 'Ann Arbor', 'Lansing', 'Flint'],
  
  // Minnesota - Enhanced with Twin Cities suburbs
  'MN': ['Minneapolis', 'Saint Paul', 'St. Paul', 'Rochester', 'Bloomington', 'Duluth', 'Brooklyn Park', 'Plymouth', 'St. Cloud', 'Woodbury', 'Eagan', 'Maple Grove', 'Eden Prairie',
         'Burnsville', 'Lakeville', 'Blaine', 'Coon Rapids', 'Apple Valley', 'Edina', 'Minnetonka', 'St. Louis Park', 'Shakopee', 'Richfield', 'Cottage Grove',
         'Moorhead', 'Mankato', 'Inver Grove Heights', 'Savage', 'Roseville', 'Fridley', 'Shoreview', 'Maplewood', 'Oakdale', 'Chaska', 'Prior Lake', 'Andover'],
  'Minnesota': ['Minneapolis', 'Saint Paul', 'St. Paul', 'Rochester', 'Bloomington', 'Duluth'],
  
  // Mississippi - Enhanced coverage
  'MS': ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi', 'Meridian', 'Tupelo', 'Greenville', 'Olive Branch', 'Horn Lake',
         'Pearl', 'Madison', 'Clinton', 'Brandon', 'Starkville', 'Columbus', 'Vicksburg', 'Pascagoula', 'Ocean Springs', 'Ridgeland', 'Flowood', 'Oxford'],
  'Mississippi': ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi'],
  
  // Missouri - Enhanced coverage
  'MO': ['Kansas City', 'St. Louis', 'Saint Louis', 'Springfield', 'Independence', 'Columbia', 'Lee\'s Summit', 'O\'Fallon', 'St. Joseph', 'St. Charles', 'Blue Springs', 'St. Peters',
         'Florissant', 'Joplin', 'Chesterfield', 'Jefferson City', 'Cape Girardeau', 'Wildwood', 'University City', 'Ballwin', 'Raytown', 'Liberty',
         'Gladstone', 'Wentzville', 'Maryland Heights', 'Hazelwood', 'Creve Coeur', 'Webster Groves', 'Kirkwood', 'Clayton', 'Ferguson', 'Overland'],
  'Missouri': ['Kansas City', 'St. Louis', 'Saint Louis', 'Springfield', 'Independence', 'Columbia'],
  
  // Montana - Enhanced coverage
  'MT': ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte', 'Helena', 'Kalispell', 'Havre',
         'Anaconda', 'Miles City', 'Livingston', 'Whitefish', 'Belgrade', 'Laurel', 'Sidney', 'Lewistown', 'Polson', 'Hamilton', 'Dillon', 'Columbia Falls'],
  'Montana': ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte', 'Helena'],
  
  // Nebraska - Enhanced coverage
  'NE': ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney', 'Fremont', 'Hastings', 'Norfolk', 'North Platte',
         'Papillion', 'La Vista', 'Columbus', 'Scottsbluff', 'South Sioux City', 'Beatrice', 'Lexington', 'Gering', 'Alliance', 'Blair', 'York', 'McCook', 'Seward'],
  'Nebraska': ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney'],
  
  // Nevada - Enhanced coverage
  'NV': ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks', 'Carson City', 'Fernley', 'Elko',
         'Mesquite', 'Boulder City', 'Fallon', 'Winnemucca', 'Summerlin', 'Enterprise', 'Paradise', 'Sunrise Manor', 'Spring Valley', 'Whitney', 'Pahrump', 'Laughlin'],
  'Nevada': ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks', 'Carson City'],
  
  // New Hampshire - Enhanced coverage
  'NH': ['Manchester', 'Nashua', 'Concord', 'Derry', 'Dover', 'Rochester', 'Salem', 'Merrimack',
         'Hudson', 'Londonderry', 'Keene', 'Portsmouth', 'Laconia', 'Lebanon', 'Hampton', 'Exeter', 'Hanover', 'Durham', 'Bedford', 'Amherst', 'Windham', 'Milford'],
  'New Hampshire': ['Manchester', 'Nashua', 'Concord', 'Derry', 'Dover'],
  
  // New Jersey - Enhanced with more suburbs
  'NJ': ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Lakewood', 'Edison', 'Woodbridge', 'Toms River', 'Trenton', 'Clifton',
         'Camden', 'Brick', 'Cherry Hill', 'Passaic', 'Union City', 'Old Bridge', 'Middletown', 'Bayonne', 'East Orange', 'Franklin', 'Princeton', 'Hoboken',
         'North Bergen', 'Vineland', 'Union', 'Piscataway', 'New Brunswick', 'Jackson', 'Wayne', 'Irvington', 'Parsippany', 'Howell',
         'Perth Amboy', 'Plainfield', 'Bloomfield', 'West New York', 'East Brunswick', 'Hackensack', 'Sayreville', 'Kearny', 'Linden', 'Atlantic City',
         'Montclair', 'West Orange', 'Livingston', 'Millburn', 'Short Hills', 'Summit', 'Morristown', 'Madison', 'Red Bank', 'Long Branch'],
  'New Jersey': ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Trenton', 'Camden'],
  
  // New Mexico - Enhanced coverage
  'NM': ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell', 'Farmington', 'Clovis', 'Hobbs', 'Alamogordo',
         'Carlsbad', 'Gallup', 'Deming', 'Los Lunas', 'Sunland Park', 'Las Vegas', 'Portales', 'Artesia', 'Lovington', 'Espanola', 'Silver City', 'Taos', 'Los Alamos'],
  'New Mexico': ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell'],
  
  // New York - Enhanced with NYC boroughs and suburbs
  'NY': ['New York', 'New York City', 'NYC', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle', 'Mount Vernon',
         'Schenectady', 'Utica', 'White Plains', 'Troy', 'Niagara Falls', 'Binghamton', 'Freeport', 'Long Beach', 'Ithaca', 'Poughkeepsie',
         'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island',
         'Hempstead', 'Brookhaven', 'Islip', 'Oyster Bay', 'Huntington', 'Babylon', 'Smithtown', 'Southampton', 'Riverhead', 'East Hampton',
         'Garden City', 'Great Neck', 'Port Washington', 'Manhasset', 'Mineola', 'Westbury', 'Jericho', 'Syosset', 'Massapequa', 'Levittown',
         'Tarrytown', 'Sleepy Hollow', 'Mamaroneck', 'Larchmont', 'Rye', 'Harrison', 'Scarsdale', 'Bronxville', 'Tuckahoe', 'Eastchester', 'Pelham'],
  'New York': ['New York', 'New York City', 'NYC', 'Buffalo', 'Rochester', 'Syracuse', 'Albany'],
  
  // North Carolina - Enhanced coverage
  'NC': ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville', 'Cary', 'Wilmington', 'High Point', 'Concord',
         'Greenville', 'Asheville', 'Gastonia', 'Jacksonville', 'Chapel Hill', 'Huntersville', 'Apex', 'Wake Forest', 'Kannapolis',
         'Indian Trail', 'Mooresville', 'Rocky Mount', 'Burlington', 'Wilson', 'Hickory', 'Salisbury', 'Monroe', 'Matthews', 'Cornelius', 'Davidson',
         'Pinehurst', 'Southern Pines', 'Sanford', 'Goldsboro', 'New Bern', 'Morehead City', 'Boone', 'Lumberton', 'Statesville', 'Thomasville'],
  'North Carolina': ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville'],
  
  // North Dakota - Enhanced coverage
  'ND': ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo', 'Williston', 'Mandan', 'Dickinson',
         'Jamestown', 'Wahpeton', 'Devils Lake', 'Valley City', 'Grafton', 'Beulah', 'Rugby', 'Bottineau', 'Watford City', 'Hazen', 'Carrington', 'Cavalier'],
  'North Dakota': ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo'],
  
  // Ohio - Enhanced with Columbus/Cleveland suburbs
  'OH': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton', 'Parma', 'Canton', 'Youngstown', 'Lorain',
         'Hamilton', 'Springfield', 'Kettering', 'Elyria', 'Lakewood', 'Cuyahoga Falls', 'Middletown', 'Newark', 'Dublin', 'Westerville',
         'Mentor', 'Beavercreek', 'Cleveland Heights', 'Strongsville', 'Fairfield', 'Grove City', 'Upper Arlington', 'Reynoldsburg', 'Hilliard', 'Lancaster',
         'Warren', 'Mansfield', 'Findlay', 'Lima', 'Marion', 'Zanesville', 'Delaware', 'Wooster', 'Bowling Green', 'Mason', 'Solon', 'Hudson'],
  'Ohio': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  
  // Oklahoma - Enhanced coverage
  'OK': ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond', 'Lawton', 'Moore', 'Midwest City', 'Enid', 'Stillwater',
         'Muskogee', 'Bartlesville', 'Owasso', 'Shawnee', 'Ponca City', 'Ardmore', 'Duncan', 'Del City', 'Yukon', 'Bixby',
         'Jenks', 'Sand Springs', 'Sapulpa', 'Claremore', 'Mustang', 'Bethany', 'Altus', 'McAlester', 'El Reno', 'Tahlequah'],
  'Oklahoma': ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond', 'Lawton'],
  
  // Oregon - Enhanced coverage
  'OR': ['Portland', 'Eugene', 'Salem', 'Gresham', 'Hillsboro', 'Beaverton', 'Bend', 'Medford', 'Springfield', 'Corvallis', 'Albany', 'Tigard', 'Lake Oswego',
         'Aloha', 'Keizer', 'Grants Pass', 'Oregon City', 'McMinnville', 'Redmond', 'Tualatin', 'West Linn', 'Woodburn', 'Forest Grove', 'Wilsonville',
         'Newberg', 'Roseburg', 'Klamath Falls', 'Ashland', 'Milwaukie', 'Coos Bay', 'Canby', 'Pendleton', 'Hermiston', 'La Grande', 'Newport', 'Astoria'],
  'Oregon': ['Portland', 'Eugene', 'Salem', 'Gresham', 'Hillsboro', 'Beaverton', 'Bend'],
  
  // Pennsylvania - Enhanced with Philly/Pittsburgh suburbs
  'PA': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Erie', 'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg', 'York',
         'State College', 'Wilkes-Barre', 'Chester', 'Altoona', 'Norristown', 'King of Prussia', 'Conshohocken',
         'Bensalem', 'Abington', 'Lower Merion', 'Upper Darby', 'Haverford', 'Radnor', 'Media', 'West Chester', 'Downingtown', 'Exton', 'Malvern',
         'Plymouth Meeting', 'Blue Bell', 'Lansdale', 'Doylestown', 'Newtown', 'Warminster', 'Levittown', 'Bristol', 'Easton', 'Pottstown',
         'Phoenixville', 'Collegeville', 'Royersford', 'Norristown', 'Ardmore', 'Bryn Mawr', 'Wayne', 'Devon', 'Villanova', 'Gladwyne'],
  'Pennsylvania': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Erie', 'Harrisburg'],
  
  // Rhode Island - Enhanced coverage
  'RI': ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence', 'Woonsocket', 'Newport', 'Central Falls',
         'Lincoln', 'Cumberland', 'West Warwick', 'North Providence', 'South Kingstown', 'Coventry', 'Johnston', 'North Kingstown', 'Bristol', 'Barrington',
         'Middletown', 'Portsmouth', 'Westerly', 'Narragansett', 'Smithfield', 'East Greenwich', 'North Smithfield', 'Tiverton', 'Warren'],
  'Rhode Island': ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'Newport'],
  
  // South Carolina - Enhanced coverage
  'SC': ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill', 'Greenville', 'Summerville', 'Sumter', 'Spartanburg', 'Hilton Head', 'Myrtle Beach',
         'Florence', 'Goose Creek', 'Aiken', 'Anderson', 'Greer', 'Mauldin', 'Simpsonville', 'Conway', 'Bluffton', 'Beaufort', 'Fort Mill', 'Lexington',
         'Easley', 'North Augusta', 'Hanahan', 'West Columbia', 'Irmo', 'Tega Cay', 'Daniel Island', 'James Island', 'Kiawah Island', 'Pawleys Island'],
  'South Carolina': ['Charleston', 'Columbia', 'Greenville', 'Rock Hill', 'Spartanburg'],
  
  // South Dakota - Enhanced coverage
  'SD': ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown', 'Mitchell', 'Yankton', 'Pierre',
         'Huron', 'Vermillion', 'Spearfish', 'Brandon', 'Box Elder', 'Madison', 'Sturgis', 'Belle Fourche', 'Lead', 'Deadwood', 'Hot Springs', 'Custer'],
  'South Dakota': ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown'],
  
  // Tennessee - Enhanced with Nashville suburbs
  'TN': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro', 'Franklin', 'Jackson', 'Johnson City', 'Bartlett', 'Hendersonville',
         'Kingsport', 'Collierville', 'Smyrna', 'Cleveland', 'Brentwood', 'Germantown', 'Columbia', 'Spring Hill', 'La Vergne', 'Gallatin', 'Cookeville',
         'Lebanon', 'Mount Juliet', 'Morristown', 'Oak Ridge', 'Maryville', 'Bristol', 'Farragut', 'Sevierville', 'Pigeon Forge', 'Gatlinburg'],
  'Tennessee': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro'],
  
  // Texas - Massively expanded with Houston/Dallas suburbs
  'TX': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Laredo',
         'Lubbock', 'Garland', 'Irving', 'Amarillo', 'Grand Prairie', 'Brownsville', 'McKinney', 'Frisco', 'Pasadena', 'Mesquite',
         'Killeen', 'McAllen', 'Waco', 'Denton', 'Carrollton', 'Midland', 'Abilene', 'Beaumont', 'Round Rock', 'Odessa',
         'Pearland', 'Richardson', 'The Woodlands', 'College Station', 'League City', 'Allen', 'Sugar Land', 'Edinburg', 'Mission', 'Lewisville',
         // New additions - Houston suburbs
         'Katy', 'Cypress', 'Spring', 'Tomball', 'Humble', 'Conroe', 'Kingwood', 'Missouri City', 'Stafford', 'Friendswood',
         'Clear Lake', 'Webster', 'Seabrook', 'La Porte', 'Deer Park', 'Baytown', 'Mont Belvieu', 'Atascocita', 'Cinco Ranch',
         // Dallas-Fort Worth suburbs
         'Flower Mound', 'Coppell', 'Rockwall', 'Mansfield', 'Burleson', 'Weatherford', 'Southlake', 'Keller', 'Grapevine', 'Colleyville',
         'Trophy Club', 'Roanoke', 'Argyle', 'Highland Village', 'Corinth', 'The Colony', 'Little Elm', 'Prosper', 'Celina', 'Anna',
         'Wylie', 'Murphy', 'Sachse', 'Rowlett', 'Sunnyvale', 'Forney', 'Heath', 'Fate', 'Lucas', 'Fairview',
         // Austin suburbs
         'Cedar Park', 'Georgetown', 'Pflugerville', 'Leander', 'Kyle', 'Buda', 'Lakeway', 'Bee Cave', 'Dripping Springs', 'Manor',
         'Hutto', 'Taylor', 'Bastrop', 'San Marcos', 'New Braunfels', 'Seguin', 'Schertz', 'Cibolo', 'Live Oak', 'Universal City',
         // Other Texas cities
         'Temple', 'Tyler', 'Longview', 'Victoria', 'Bryan', 'Harlingen', 'Pharr', 'Weslaco', 'Port Arthur', 'Galveston',
         'Texarkana', 'San Angelo', 'Wichita Falls', 'Sherman', 'Denison', 'Nacogdoches', 'Lufkin'],
  'Texas': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington'],
  
  // Utah - Enhanced coverage
  'UT': ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem', 'Sandy', 'Ogden', 'St. George', 'Layton', 'Taylorsville', 'Lehi', 'Logan',
         'Murray', 'Draper', 'Bountiful', 'Riverton', 'Herriman', 'Spanish Fork', 'Roy', 'Pleasant Grove', 'Cottonwood Heights', 'Tooele',
         'Springville', 'Cedar City', 'Midvale', 'Kaysville', 'Holladay', 'American Fork', 'Clearfield', 'Syracuse', 'South Jordan', 'Eagle Mountain', 'Saratoga Springs'],
  'Utah': ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem', 'Sandy', 'Ogden'],
  
  // Vermont - Enhanced coverage
  'VT': ['Burlington', 'South Burlington', 'Rutland', 'Barre', 'Montpelier', 'St. Albans', 'Winooski', 'Bennington',
         'Essex', 'Brattleboro', 'Hartford', 'Milton', 'Colchester', 'Williston', 'Essex Junction', 'St. Johnsbury', 'Middlebury', 'Springfield', 'Newport', 'Vergennes', 'Stowe', 'Woodstock'],
  'Vermont': ['Burlington', 'South Burlington', 'Rutland', 'Montpelier'],
  
  // Virginia - Enhanced with DC suburbs
  'VA': ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News', 'Alexandria', 'Hampton', 'Roanoke', 'Portsmouth', 'Suffolk',
         'Lynchburg', 'Harrisonburg', 'Charlottesville', 'Danville', 'Manassas', 'Arlington', 'Fairfax', 'Falls Church', 'McLean', 'Tysons',
         'Ashburn', 'Leesburg', 'Sterling', 'Reston', 'Herndon', 'Vienna', 'Great Falls', 'Annandale', 'Burke', 'Springfield',
         'Centreville', 'Chantilly', 'Bristow', 'Gainesville', 'Haymarket', 'Warrenton', 'Fredericksburg', 'Stafford', 'Woodbridge', 'Dale City',
         'Lake Ridge', 'Dumfries', 'Lorton', 'Mount Vernon', 'Fort Hunt', 'Belle Haven', 'Franconia', 'Kingstowne', 'Newington', 'Occoquan'],
  'Virginia': ['Virginia Beach', 'Norfolk', 'Richmond', 'Chesapeake', 'Alexandria', 'Newport News'],
  
  // Washington - Enhanced with Seattle suburbs
  'WA': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent', 'Everett', 'Renton', 'Spokane Valley', 'Federal Way',
         'Yakima', 'Bellingham', 'Kirkland', 'Kennewick', 'Auburn', 'Redmond', 'Marysville', 'Pasco', 'Richland', 'Sammamish', 'Olympia', 'Bothell',
         'Issaquah', 'Burien', 'SeaTac', 'Tukwila', 'Woodinville', 'Mercer Island', 'Bainbridge Island', 'Newcastle', 'Maple Valley', 'Covington',
         'Lake Forest Park', 'Shoreline', 'Mountlake Terrace', 'Lynnwood', 'Edmonds', 'Mukilteo', 'Lake Stevens', 'Snohomish', 'Monroe',
         'Bonney Lake', 'Puyallup', 'Sumner', 'Fife', 'University Place', 'Lakewood', 'DuPont', 'Joint Base Lewis-McChord', 'Gig Harbor', 'Bremerton'],
  'Washington': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Everett'],
  
  // Washington DC
  'DC': ['Washington', 'Washington DC', 'Washington, D.C.', 'D.C.', 'Georgetown', 'Capitol Hill', 'Dupont Circle', 'Adams Morgan', 'Foggy Bottom', 'Navy Yard'],
  'District of Columbia': ['Washington', 'Washington DC'],
  
  // West Virginia - Enhanced coverage
  'WV': ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling', 'Weirton', 'Fairmont', 'Martinsburg', 'Beckley',
         'Clarksburg', 'South Charleston', 'Teays Valley', 'St. Albans', 'Vienna', 'Bluefield', 'Bridgeport', 'Oak Hill', 'Dunbar', 'Elkins', 'Nitro', 'Hurricane', 'Princeton'],
  'West Virginia': ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling'],
  
  // Wisconsin - Enhanced with Milwaukee suburbs
  'WI': ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton', 'Waukesha', 'Eau Claire', 'Oshkosh', 'Janesville', 'West Allis', 'La Crosse',
         'Sheboygan', 'Wauwatosa', 'Fond du Lac', 'New Berlin', 'Brookfield', 'Greenfield', 'Franklin', 'Beloit', 'Menomonee Falls', 'Oak Creek',
         'Fitchburg', 'Sun Prairie', 'Middleton', 'Verona', 'Waunakee', 'Stoughton', 'De Pere', 'Ashwaubenon', 'Howard', 'Suamico',
         'Mequon', 'Cedarburg', 'Grafton', 'Port Washington', 'West Bend', 'Germantown', 'Pewaukee', 'Hartland', 'Oconomowoc', 'Delafield'],
  'Wisconsin': ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton'],
  
  // Wyoming - Enhanced coverage
  'WY': ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs', 'Sheridan', 'Green River', 'Evanston', 'Riverton', 'Jackson',
         'Cody', 'Powell', 'Douglas', 'Rawlins', 'Lander', 'Torrington', 'Worland', 'Buffalo', 'Thermopolis', 'Newcastle', 'Wheatland', 'Afton'],
  'Wyoming': ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs'],
};

/**
 * Validation options for city/state matching
 */
export interface CityValidationOptions {
  strictMode?: boolean;    // If true, reject unknown cities
  allowSuburbs?: boolean;  // If false, only validate major cities
}

export interface LocationValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Normalize city name to get all possible variants (canonical + aliases)
 */
function normalizeCityName(city: string): string[] {
  const variants = [city.toLowerCase().trim()];
  
  // Check if this city has known aliases
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (canonical.toLowerCase() === city.toLowerCase().trim()) {
      // Add all aliases for this canonical name
      aliases.forEach(alias => variants.push(alias.toLowerCase()));
    }
    // Also check if input is an alias - add the canonical name
    if (aliases.some(a => a.toLowerCase() === city.toLowerCase().trim())) {
      variants.push(canonical.toLowerCase());
    }
  }
  
  return variants;
}

/**
 * Validate city/state combination for US addresses
 * Returns invalid if city cannot exist in the given state
 * Supports city aliases (e.g., "LA" for "Los Angeles", "NYC" for "New York")
 */
export function validateCityStateMatch(
  city: string | undefined, 
  state: string | undefined,
  options: CityValidationOptions = {}
): LocationValidationResult {
  if (!city || !state) {
    return { isValid: true }; // Can't validate without both
  }
  
  // Try to get valid cities for the state
  const validCities = US_STATE_CITIES[state] || US_STATE_CITIES[state.toUpperCase()];
  
  if (!validCities) {
    // Unknown state - might be international
    return options.strictMode 
      ? { isValid: false, reason: `Unknown state: ${state}` }
      : { isValid: true };
  }
  
  // Get all variants of the city name (including aliases)
  const cityVariants = normalizeCityName(city);
  
  // Check for match against valid cities
  const matches = validCities.some(validCity => {
    const validLower = validCity.toLowerCase();
    return cityVariants.some(variant => 
      variant === validLower ||
      variant.includes(validLower) ||
      validLower.includes(variant)
    );
  });
  
  if (!matches) {
    // If not in strict mode, allow unknown cities through
    if (!options.strictMode) {
      return { isValid: true };
    }
    return { 
      isValid: false, 
      reason: `City "${city}" is not a recognized city in ${state}` 
    };
  }
  
  return { isValid: true };
}

/**
 * Get the canonical city name from an alias
 * Returns the input if no alias mapping found
 */
export function getCanonicalCityName(city: string): string {
  const cityLower = city.toLowerCase().trim();
  
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.some(a => a.toLowerCase() === cityLower)) {
      return canonical;
    }
  }
  
  return city;
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
 * Comprehensive whitelist of valid tech stack items (~410 items across 26 categories)
 * Used to filter AI hallucinations during enrichment
 */
const VALID_TECH_STACK_ITEMS = new Set([
  // Cloud Providers (22 items)
  'AWS', 'Amazon Web Services', 'Azure', 'Microsoft Azure', 'GCP', 'Google Cloud', 'Google Cloud Platform',
  'DigitalOcean', 'Heroku', 'Linode', 'Vultr', 'OVH', 'IBM Cloud', 'Oracle Cloud', 'Alibaba Cloud', 'Cloudflare',
  'Vercel', 'Netlify', 'Render', 'Railway', 'Fly.io', 'PlanetScale',
  
  // Databases (30 items)
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'SQLite', 'MariaDB', 'Oracle', 'SQL Server',
  'Microsoft SQL Server', 'Cassandra', 'DynamoDB', 'Firebase', 'Firestore', 'Supabase', 'CockroachDB', 'TimescaleDB',
  'InfluxDB', 'Neo4j', 'Couchbase', 'RethinkDB', 'FaunaDB', 'Fauna', 'ArangoDB', 'ClickHouse', 'Snowflake', 'BigQuery',
  'Redshift', 'Amazon RDS', 'Aurora', 'Amazon Aurora', 'Cosmos DB', 'Azure SQL',
  
  // Frontend Frameworks (45 items)
  'React', 'React.js', 'ReactJS', 'Angular', 'Vue', 'Vue.js', 'VueJS', 'Svelte', 'SvelteKit', 'Next.js', 'NextJS',
  'Nuxt', 'Nuxt.js', 'Gatsby', 'Remix', 'Astro', 'Solid', 'SolidJS', 'Preact', 'Lit', 'Alpine.js', 'Ember',
  'Backbone', 'jQuery', 'Bootstrap', 'Tailwind', 'Tailwind CSS', 'Material UI', 'MUI', 'Chakra UI', 'Ant Design',
  'Styled Components', 'Emotion', 'Sass', 'SCSS', 'Less', 'CSS Modules', 'PostCSS', 'Framer Motion', 'Three.js',
  'D3', 'D3.js', 'Chart.js', 'Recharts', 'ECharts', 'Highcharts', 'WebGL',
  
  // Backend Frameworks (60 items - expanded +5)
  'Node.js', 'NodeJS', 'Express', 'Express.js', 'Fastify', 'Koa', 'Hapi', 'NestJS', 'Nest.js', 'Adonis', 'AdonisJS',
  'Django', 'Flask', 'FastAPI', 'Tornado', 'Pyramid', 'Rails', 'Ruby on Rails', 'Sinatra', 'Hanami',
  'Spring', 'Spring Boot', 'Spring Framework', 'Quarkus', 'Micronaut', 'Play Framework', 'Vert.x',
  'Laravel', 'Symfony', 'CodeIgniter', 'CakePHP', 'Slim', 'Lumen', 'Yii', 'Zend', 'Laminas',
  'ASP.NET', '.NET', 'ASP.NET Core', '.NET Core', 'Blazor', 'Entity Framework',
  'Go', 'Golang', 'Gin', 'Echo', 'Fiber', 'Chi', 'Buffalo', 'Beego',
  'Rust', 'Actix', 'Rocket', 'Axum', 'Tokio', 'Warp',
  'Elixir', 'Phoenix', 'Ecto',
  'Scala', 'Akka',
  // NEW: Modern runtimes
  'Bun', 'Deno', 'Elysia', 'Hono', 'tRPC',
  
  // Mobile (15 items)
  'React Native', 'Flutter', 'Dart', 'Swift', 'SwiftUI', 'Kotlin', 'Objective-C', 'Xamarin', 'Ionic', 'Capacitor',
  'Cordova', 'PhoneGap', 'Expo', 'NativeScript', 'MAUI', '.NET MAUI',
  
  // DevOps & Infrastructure (53 items - expanded +8)
  'Docker', 'Kubernetes', 'K8s', 'Terraform', 'Ansible', 'Puppet', 'Chef', 'Jenkins', 'CircleCI', 'Travis CI',
  'GitHub Actions', 'GitLab CI', 'Azure DevOps', 'TeamCity', 'Bamboo', 'ArgoCD', 'Argo CD', 'Flux', 'Helm',
  'Rancher', 'OpenShift', 'EKS', 'GKE', 'AKS', 'Vagrant', 'Packer', 'Consul', 'Vault', 'Nomad',
  'Prometheus', 'Grafana', 'Datadog', 'New Relic', 'Splunk', 'ELK', 'Elastic Stack', 'Logstash', 'Kibana',
  'Sentry', 'PagerDuty', 'OpsGenie', 'StatusPage', 'Nginx', 'Apache', 'Caddy', 'Traefik', 'HAProxy', 'Envoy',
  // NEW: Modern infrastructure
  'Pulumi', 'Crossplane', 'Spacelift', 'Teleport', 'Boundary', 'Istio', 'Linkerd', 'Service Mesh',
  
  // CRM & Sales (16 items)
  'Salesforce', 'HubSpot', 'Pipedrive', 'Zoho', 'Zoho CRM', 'Microsoft Dynamics', 'SAP', 'SAP CRM', 'SugarCRM',
  'Freshsales', 'Close', 'Apollo', 'Outreach', 'Salesloft', 'Gong', 'Chorus', 'Clari', 'ZoomInfo', 'LinkedIn Sales Navigator',
  
  // Marketing (25 items)
  'Marketo', 'Pardot', 'Eloqua', 'Mailchimp', 'ActiveCampaign', 'Constant Contact', 'SendGrid', 'Postmark', 'Mailgun',
  'Braze', 'Iterable', 'Customer.io', 'Klaviyo', 'Drip', 'ConvertKit', 'AWeber', 'Campaign Monitor', 'Sendinblue',
  'Google Ads', 'Facebook Ads', 'LinkedIn Ads', 'Twitter Ads', 'Bing Ads', 'AdRoll', 'Criteo',
  
  // Analytics (27 items)
  'Google Analytics', 'GA4', 'Google Analytics 4', 'Mixpanel', 'Amplitude', 'Segment', 'Heap', 'Pendo', 'FullStory',
  'Hotjar', 'Crazy Egg', 'Lucky Orange', 'Mouseflow', 'PostHog', 'Plausible', 'Fathom', 'Matomo', 'Kissmetrics',
  'Looker', 'Tableau', 'Power BI', 'Metabase', 'Mode', 'Sisense', 'Domo', 'Qlik', 'ThoughtSpot',
  
  // Customer Support (16 items)
  'Intercom', 'Zendesk', 'Freshdesk', 'Help Scout', 'Drift', 'Crisp', 'Olark', 'LiveChat', 'Tawk.to', 'Front',
  'Helpshift', 'Kustomer', 'Gladly', 'Dixa', 'Groove', 'Kayako',
  
  // Payments (19 items)
  'Stripe', 'PayPal', 'Braintree', 'Square', 'Adyen', 'Worldpay', 'Authorize.net', 'Chargebee', 'Recurly', 'Zuora',
  'Paddle', 'FastSpring', 'Gumroad', 'Shopify Payments', 'Klarna', 'Afterpay', 'Affirm', 'Apple Pay', 'Google Pay',
  
  // E-commerce (15 items)
  'Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Squarespace', 'Wix', 'PrestaShop', 'OpenCart', 'Volusion',
  'Salesforce Commerce Cloud', 'SAP Commerce', 'Oracle Commerce', 'Adobe Commerce', 'CommerceTools',
  
  // CMS (18 items)
  'WordPress', 'Drupal', 'Joomla', 'Contentful', 'Sanity', 'Strapi', 'Ghost', 'Webflow', 'Prismic', 'DatoCMS',
  'Storyblok', 'Hygraph', 'Butter CMS', 'Kentico', 'Sitecore', 'Adobe Experience Manager', 'AEM', 'Umbraco',
  
  // Communication (17 items)
  'Slack', 'Microsoft Teams', 'Teams', 'Discord', 'Zoom', 'Google Meet', 'Whereby', 'Twilio', 'SendBird', 'Stream',
  'PubNub', 'Pusher', 'Ably', 'Firebase Cloud Messaging', 'FCM', 'OneSignal', 'Airship',
  
  // Authentication (16 items)
  'Auth0', 'Okta', 'Firebase Auth', 'AWS Cognito', 'Cognito', 'Azure AD', 'Azure Active Directory', 'OneLogin',
  'Ping Identity', 'ForgeRock', 'Keycloak', 'FusionAuth', 'Clerk', 'Supabase Auth', 'Magic', 'Stytch',
  
  // Version Control (9 items)
  'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Azure Repos', 'AWS CodeCommit', 'Perforce', 'SVN', 'Mercurial',
  
  // Project Management (16 items)
  'Jira', 'Asana', 'Monday', 'Monday.com', 'Trello', 'ClickUp', 'Notion', 'Linear', 'Basecamp', 'Wrike',
  'Smartsheet', 'Airtable', 'Shortcut', 'Clubhouse', 'Pivotal Tracker', 'Azure Boards',
  
  // AI & ML (38 items - expanded +10)
  'TensorFlow', 'PyTorch', 'Keras', 'scikit-learn', 'OpenAI', 'GPT', 'GPT-4', 'ChatGPT', 'Claude', 'Anthropic',
  'Hugging Face', 'LangChain', 'OpenCV', 'spaCy', 'NLTK', 'AWS SageMaker', 'SageMaker', 'Azure ML', 'Vertex AI',
  'MLflow', 'Weights & Biases', 'W&B', 'Comet', 'Neptune', 'DataRobot', 'H2O', 'Ray', 'Dask',
  // NEW: Modern AI/ML
  'Stable Diffusion', 'Midjourney', 'Replicate', 'Modal', 'Anyscale', 'Mosaic ML',
  'LlamaIndex', 'Cohere', 'FAISS', 'Anthropic Claude',
  
  // NEW: Security & Compliance (15 items)
  'Cloudflare WAF', 'AWS WAF', 'Akamai', 'Imperva', 'F5',
  'HashiCorp Vault', 'AWS Secrets Manager', 'Doppler', '1Password',
  'Vanta', 'Drata', 'Secureframe', 'CrowdStrike', 'SentinelOne', 'Snyk',
  
  // NEW: Data Engineering (20 items)
  'Fivetran', 'Airbyte', 'Stitch', 'Matillion', 'dbt', 'dbt Cloud',
  'Apache Airflow', 'Airflow', 'Dagster', 'Prefect', 'Mage', 'Luigi',
  'Databricks', 'Delta Lake', 'Apache Iceberg', 'Apache Hudi',
  'Apache Flink', 'Apache Spark', 'Spark', 'Apache Beam', 'Debezium',
  
  // NEW: Search & Vector Databases (10 items)
  'Algolia', 'MeiliSearch', 'Typesense', 'Apache Solr', 'OpenSearch',
  'Pinecone', 'Weaviate', 'Milvus', 'Qdrant', 'Chroma',
  
  // NEW: Low-Code/No-Code (12 items)
  'Zapier', 'Make', 'Integromat', 'n8n', 'Tray.io', 'Workato',
  'Retool', 'Budibase', 'Appsmith', 'Bubble', 'Glide', 'Outsystems',
  
  // NEW: API Management (10 items)
  'Kong', 'Apigee', 'MuleSoft', 'Postman', 'Swagger', 'OpenAPI',
  'AWS API Gateway', 'Azure API Management', 'Tyk', 'Ambassador',
  
  // NEW: Video & Media (10 items)
  'Mux', 'Cloudinary', 'ImageKit', 'Imgix', 'Vimeo',
  'Wistia', 'Brightcove', 'JW Player', 'Video.js', 'FFmpeg',
  
  // NEW: Testing & QA (20 items - expanded)
  'Sauce Labs', 'BrowserStack', 'LambdaTest', 'Appium',
  'TestRail', 'Qase', 'Allure', 'k6', 'Artillery', 'Gatling',
  
  // Misc (40+ items)
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
