// ZoomInfo Industry Taxonomy - Parsed from official CSV
// Source: ZoomInfo Locations, Industries & Codes

export interface IndustryMapping {
  primary: string;
  subIndustries: string[];
}

export const ZOOMINFO_INDUSTRIES: IndustryMapping[] = [
  {
    primary: "Agriculture",
    subIndustries: [
      "Animals & Livestock",
      "Crops",
      "Forestry"
    ]
  },
  {
    primary: "Business Services",
    subIndustries: [
      "Accounting Services",
      "Advertising & Marketing",
      "Call Centers & Business Centers",
      "Chambers of Commerce",
      "Commercial Printing",
      "Custom Software & IT Services",
      "Debt Collection",
      "Facilities Management & Commercial Cleaning",
      "Food Service",
      "HR & Staffing",
      "Information & Document Management",
      "Management Consulting",
      "Multimedia & Graphic Design",
      "Research & Development",
      "Security Products & Services",
      "Translation & Linguistic Services"
    ]
  },
  {
    primary: "Construction",
    subIndustries: [
      "Architecture, Engineering & Design",
      "Civil Engineering Construction",
      "Commercial & Residential Construction"
    ]
  },
  {
    primary: "Consumer Services",
    subIndustries: [
      "Automotive Service & Collision Repair",
      "Barber Shops & Beauty Salons",
      "Car & Truck Rental",
      "Childcare",
      "Cleaning Services",
      "Funeral Homes & Funeral Related Services",
      "Landscape Services",
      "Photography Studio",
      "Repair Services",
      "Weight & Health Management"
    ]
  },
  {
    primary: "Education",
    subIndustries: [
      "Colleges & Universities",
      "K-12 Schools",
      "Training"
    ]
  },
  {
    primary: "Energy, Utilities & Waste",
    subIndustries: [
      "Electricity, Oil & Gas",
      "Oil & Gas Exploration & Services",
      "Waste Treatment, Environmental Services & Recycling",
      "Water Treatment"
    ]
  },
  {
    primary: "Finance",
    subIndustries: [
      "Banking",
      "Credit Cards & Transaction Processing",
      "Investment Banking",
      "Lending & Brokerage",
      "Venture Capital & Private Equity"
    ]
  },
  {
    primary: "Government",
    subIndustries: [
      "Federal",
      "Local",
      "State",
      "Tribal Nations"
    ]
  },
  {
    primary: "Healthcare Services",
    subIndustries: [
      "Ambulance Services",
      "Blood & Organ Banks",
      "Elderly Care Services",
      "Medical Laboratories & Imaging Centers",
      "Mental Health & Rehabilitation Facilities",
      "Veterinary Services"
    ]
  },
  {
    primary: "Holding Companies & Conglomerates",
    subIndustries: []
  },
  {
    primary: "Hospitals & Physicians Clinics",
    subIndustries: [
      "Dental Offices",
      "Medical & Surgical Hospitals",
      "Medical Specialists",
      "Physicians Clinics"
    ]
  },
  {
    primary: "Hospitality",
    subIndustries: [
      "Amusement Parks, Arcades & Attractions",
      "Cultural & Informational Centers",
      "Fitness & Dance Facilities",
      "Gambling & Gaming",
      "Libraries",
      "Lodging & Resorts",
      "Movie Theaters",
      "Museums & Art Galleries",
      "Performing Arts Theaters",
      "Restaurants",
      "Sports Teams & Leagues",
      "Travel Agencies & Services",
      "Zoos & National Parks"
    ]
  },
  {
    primary: "Insurance",
    subIndustries: []
  },
  {
    primary: "Law Firms & Legal Services",
    subIndustries: []
  },
  {
    primary: "Manufacturing",
    subIndustries: [
      "Aerospace & Defense",
      "Appliances",
      "Automotive Parts",
      "Boats & Submarines",
      "Building Materials",
      "Chemicals & Related Products",
      "Cleaning Products",
      "Computer Equipment & Peripherals",
      "Cosmetics, Beauty Supply & Personal Care Products",
      "Electronics",
      "Food & Beverage",
      "Furniture",
      "Glass & Clay",
      "Hand, Power & Lawn-care Tools",
      "Health & Nutrition Products",
      "Household Goods",
      "Industrial Machinery & Equipment",
      "Medical Devices & Equipment",
      "Motor Vehicles",
      "Pet Products",
      "Pharmaceuticals",
      "Photographic & Optical Equipment",
      "Plastic, Packaging & Containers",
      "Pulp & Paper",
      "Sporting Goods",
      "Telecommunication Equipment",
      "Test & Measurement Equipment",
      "Textiles & Apparel",
      "Tires & Rubber",
      "Toys & Games",
      "Watches & Jewelry",
      "Wire & Cable"
    ]
  },
  {
    primary: "Media & Internet",
    subIndustries: [
      "Broadcasting",
      "Publishing",
      "Social Networks",
      "Newspapers & News Services",
      "Data Collection & Internet Portals",
      "Ticket Sales",
      "Music Production & Services"
    ]
  },
  {
    primary: "Minerals & Mining",
    subIndustries: []
  },
  {
    primary: "Organizations",
    subIndustries: [
      "Membership Organizations",
      "Non-Profit & Charitable Organizations",
      "Religious Organizations"
    ]
  },
  {
    primary: "Real Estate",
    subIndustries: []
  },
  {
    primary: "Retail",
    subIndustries: [
      "Apparel & Accessories Retail",
      "Auctions",
      "Automobile Dealers",
      "Automobile Parts Stores",
      "Consumer Electronics & Computers Retail",
      "Convenience Stores, Gas Stations & Liquor Stores",
      "Department Stores, Shopping Centers & Superstores",
      "Drug Stores & Pharmacies",
      "Flowers, Gifts & Specialty Stores",
      "Furniture",
      "Grocery Retail",
      "Home Improvement & Hardware Retail",
      "Jewelry & Watch Retail",
      "Office Products Retail & Distribution",
      "Other Rental Stores (Furniture, A/V, Construction & Industrial Equipment)",
      "Pet Products",
      "Record, Video & Book Stores",
      "Sporting & Recreational Equipment Retail",
      "Toys & Games",
      "Vitamins, Supplements & Health Stores"
    ]
  },
  {
    primary: "Software",
    subIndustries: [
      "Business Intelligence (BI) Software",
      "Content & Collaboration Software",
      "Customer Relationship Management (CRM) Software",
      "Database & File Management Software",
      "Engineering Software",
      "Enterprise Resource Planning (ERP) Software",
      "Financial Software",
      "Healthcare Software",
      "Human Resources Software",
      "Legal Software",
      "Mobile App Development",
      "Multimedia, Games & Graphics Software",
      "Networking Software",
      "Security Software",
      "Storage & System Management Software",
      "Supply Chain Management (SCM) Software"
    ]
  },
  {
    primary: "Telecommunications",
    subIndustries: [
      "Cable & Satellite",
      "Internet Service Providers, Website Hosting & Internet-related Services",
      "Telephony & Wireless"
    ]
  },
  {
    primary: "Transportation",
    subIndustries: [
      "Airlines, Airports & Air Services",
      "Freight & Logistics Services",
      "Marine Shipping & Transportation",
      "Rail, Bus & Taxi",
      "Trucking, Moving & Storage"
    ]
  }
];

// Helper functions for quick lookups
export const PRIMARY_INDUSTRIES = ZOOMINFO_INDUSTRIES.map(i => i.primary).sort();

export const SUB_INDUSTRIES_MAP = ZOOMINFO_INDUSTRIES.reduce((acc, industry) => {
  acc[industry.primary] = industry.subIndustries.sort();
  return acc;
}, {} as Record<string, string[]>);

export const ALL_SUB_INDUSTRIES = ZOOMINFO_INDUSTRIES
  .flatMap(i => i.subIndustries)
  .sort();

// Get sub-industries for a given primary industry
export function getSubIndustries(primaryIndustry: string): string[] {
  return SUB_INDUSTRIES_MAP[primaryIndustry] || [];
}

// Find primary industry for a given sub-industry
export function findPrimaryIndustry(subIndustry: string): string | null {
  const industry = ZOOMINFO_INDUSTRIES.find(i => 
    i.subIndustries.includes(subIndustry)
  );
  return industry?.primary || null;
}

// Fuzzy match industry string to ZoomInfo taxonomy
export function fuzzyMatchIndustry(input: string): { primary: string; sub: string | null; confidence: number } | null {
  if (!input) return null;
  
  const normalized = input.toLowerCase().trim();
  
  // Exact primary match
  for (const industry of ZOOMINFO_INDUSTRIES) {
    if (industry.primary.toLowerCase() === normalized) {
      return { primary: industry.primary, sub: null, confidence: 1.0 };
    }
  }
  
  // Exact sub-industry match
  for (const industry of ZOOMINFO_INDUSTRIES) {
    for (const sub of industry.subIndustries) {
      if (sub.toLowerCase() === normalized) {
        return { primary: industry.primary, sub, confidence: 1.0 };
      }
    }
  }
  
  // Partial match
  for (const industry of ZOOMINFO_INDUSTRIES) {
    if (normalized.includes(industry.primary.toLowerCase()) || industry.primary.toLowerCase().includes(normalized)) {
      return { primary: industry.primary, sub: null, confidence: 0.8 };
    }
    
    for (const sub of industry.subIndustries) {
      if (normalized.includes(sub.toLowerCase()) || sub.toLowerCase().includes(normalized)) {
        return { primary: industry.primary, sub, confidence: 0.7 };
      }
    }
  }
  
  return null;
}
