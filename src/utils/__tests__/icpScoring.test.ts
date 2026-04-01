import { describe, it, expect } from 'vitest';

// ICP Scoring logic (extracted for testing)
interface ICPCriteria {
  industries?: string[];
  minEmployees?: number;
  maxEmployees?: number;
  minRevenue?: number;
  maxRevenue?: number;
  countries?: string[];
  techStack?: string[];
}

interface Account {
  industry_norm?: string | null;
  employee_count?: number | null;
  revenue_range?: string | null;
  country?: string | null;
  tech_stack?: string[] | null;
}

interface ScoreResult {
  score: number;
  maxScore: number;
  percentage: number;
  matchedCriteria: string[];
  failedCriteria: string[];
}

function parseRevenueRange(range: string | null | undefined): number {
  if (!range) return 0;
  
  const cleanRange = range.toLowerCase().replace(/[$,]/g, '');
  
  // Extract the first number for range strings like "50m-100m"
  const rangeMatch = cleanRange.match(/^(\d+)([mb])/);
  if (rangeMatch) {
    const num = parseInt(rangeMatch[1], 10);
    const unit = rangeMatch[2];
    if (unit === 'b') return num * 1000000000;
    return num * 1000000;
  }
  
  if (cleanRange.includes('billion')) return 1000000000;
  
  const match = cleanRange.match(/(\d+)/);
  return match ? parseInt(match[1], 10) * 1000000 : 0;
}

function calculateICPScore(account: Account, criteria: ICPCriteria): ScoreResult {
  const matchedCriteria: string[] = [];
  const failedCriteria: string[] = [];
  let score = 0;
  let maxScore = 0;

  // Industry match (weight: 25)
  if (criteria.industries && criteria.industries.length > 0) {
    maxScore += 25;
    if (account.industry_norm && criteria.industries.some(
      ind => account.industry_norm?.toLowerCase().includes(ind.toLowerCase())
    )) {
      score += 25;
      matchedCriteria.push('industry');
    } else {
      failedCriteria.push('industry');
    }
  }

  // Employee count (weight: 20)
  if (criteria.minEmployees !== undefined || criteria.maxEmployees !== undefined) {
    maxScore += 20;
    const empCount = account.employee_count || 0;
    const meetsMin = criteria.minEmployees === undefined || empCount >= criteria.minEmployees;
    const meetsMax = criteria.maxEmployees === undefined || empCount <= criteria.maxEmployees;
    
    if (meetsMin && meetsMax) {
      score += 20;
      matchedCriteria.push('employee_count');
    } else {
      failedCriteria.push('employee_count');
    }
  }

  // Revenue (weight: 20)
  if (criteria.minRevenue !== undefined || criteria.maxRevenue !== undefined) {
    maxScore += 20;
    const revenue = parseRevenueRange(account.revenue_range);
    const meetsMin = criteria.minRevenue === undefined || revenue >= criteria.minRevenue;
    const meetsMax = criteria.maxRevenue === undefined || revenue <= criteria.maxRevenue;
    
    if (meetsMin && meetsMax) {
      score += 20;
      matchedCriteria.push('revenue');
    } else {
      failedCriteria.push('revenue');
    }
  }

  // Country (weight: 15)
  if (criteria.countries && criteria.countries.length > 0) {
    maxScore += 15;
    if (account.country && criteria.countries.some(
      c => c.toLowerCase() === account.country?.toLowerCase()
    )) {
      score += 15;
      matchedCriteria.push('country');
    } else {
      failedCriteria.push('country');
    }
  }

  // Tech stack (weight: 20)
  if (criteria.techStack && criteria.techStack.length > 0) {
    maxScore += 20;
    const accountTech = account.tech_stack || [];
    const matchingTech = criteria.techStack.filter(tech =>
      accountTech.some(at => at.toLowerCase().includes(tech.toLowerCase()))
    );
    
    if (matchingTech.length > 0) {
      // Partial credit based on match percentage
      const matchPercentage = matchingTech.length / criteria.techStack.length;
      score += Math.round(20 * matchPercentage);
      matchedCriteria.push('tech_stack');
    } else {
      failedCriteria.push('tech_stack');
    }
  }

  return {
    score,
    maxScore: maxScore || 100,
    percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    matchedCriteria,
    failedCriteria,
  };
}

describe('parseRevenueRange', () => {
  it('parses billion values correctly', () => {
    expect(parseRevenueRange('$1B+')).toBe(1000000000);
    expect(parseRevenueRange('1 billion')).toBe(1000000000);
  });

  it('parses million values correctly', () => {
    expect(parseRevenueRange('$50M-$100M')).toBe(50000000);
    expect(parseRevenueRange('10M')).toBe(10000000);
  });

  it('returns 0 for null or undefined', () => {
    expect(parseRevenueRange(null)).toBe(0);
    expect(parseRevenueRange(undefined)).toBe(0);
  });
});

describe('calculateICPScore', () => {
  const mockCriteria: ICPCriteria = {
    industries: ['Technology', 'Software'],
    minEmployees: 50,
    maxEmployees: 1000,
    countries: ['United States', 'Canada'],
    techStack: ['React', 'Node.js'],
  };

  it('returns full score for perfect match', () => {
    const account: Account = {
      industry_norm: 'Technology',
      employee_count: 200,
      country: 'United States',
      tech_stack: ['React', 'Node.js', 'PostgreSQL'],
    };

    const result = calculateICPScore(account, mockCriteria);
    expect(result.percentage).toBe(100);
    expect(result.failedCriteria).toHaveLength(0);
  });

  it('returns zero for complete mismatch', () => {
    const account: Account = {
      industry_norm: 'Healthcare',
      employee_count: 5000,
      country: 'Germany',
      tech_stack: ['Java', '.NET'],
    };

    const result = calculateICPScore(account, mockCriteria);
    expect(result.score).toBe(0);
    expect(result.matchedCriteria).toHaveLength(0);
  });

  it('handles partial matches correctly', () => {
    const account: Account = {
      industry_norm: 'Software Development',
      employee_count: 100,
      country: 'United Kingdom', // No match
      tech_stack: ['React'], // Partial match (1 of 2)
    };

    const result = calculateICPScore(account, mockCriteria);
    expect(result.matchedCriteria).toContain('industry');
    expect(result.matchedCriteria).toContain('employee_count');
    expect(result.failedCriteria).toContain('country');
  });

  it('handles empty criteria gracefully', () => {
    const account: Account = {
      industry_norm: 'Technology',
      employee_count: 100,
    };

    const result = calculateICPScore(account, {});
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(100);
  });

  it('handles null account fields', () => {
    const account: Account = {
      industry_norm: null,
      employee_count: null,
      country: null,
      tech_stack: null,
    };

    const result = calculateICPScore(account, mockCriteria);
    expect(result.score).toBe(0);
    expect(result.failedCriteria.length).toBeGreaterThan(0);
  });
});
