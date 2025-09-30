/**
 * Smart data type detection utility
 * Determines if a row represents a lead, contact, or account
 */

export interface DetectionResult {
  type: 'lead' | 'contact' | 'account';
  confidence: number;
  reason: string;
}

export const detectDataType = (row: any): DetectionResult => {
  const hasPersonalInfo = !!(row.first_name || row.last_name || row.email);
  const hasCompanyInfo = !!(row.company || row.name);
  const hasContactId = !!(row.contact_id || row.external_id?.toString().toLowerCase().includes('cont'));
  const hasAccountId = !!(row.account_id || row.external_id?.toString().toLowerCase().includes('acc'));
  const hasLeadId = !!(row.lead_id || row.external_id?.toString().toLowerCase().includes('lead'));
  const hasStatus = !!row.status;
  const hasTitle = !!row.title;

  // Lead detection: personal info + company info + possibly status
  if (hasPersonalInfo && hasCompanyInfo && (hasLeadId || hasStatus)) {
    return {
      type: 'lead',
      confidence: 90,
      reason: 'Has personal info, company info, and lead indicators'
    };
  }

  // Contact detection: personal info + title, or has contact_id
  if ((hasPersonalInfo && hasTitle) || hasContactId) {
    return {
      type: 'contact',
      confidence: 85,
      reason: 'Has personal info with title or contact identifier'
    };
  }

  // Account detection: company info without personal info, or has account_id
  if ((hasCompanyInfo && !hasPersonalInfo) || hasAccountId) {
    return {
      type: 'account',
      confidence: 80,
      reason: 'Has company info without personal info or account identifier'
    };
  }

  // Default to lead if mixed data
  if (hasPersonalInfo || hasCompanyInfo) {
    return {
      type: 'lead',
      confidence: 60,
      reason: 'Mixed data - defaulting to lead'
    };
  }

  return {
    type: 'lead',
    confidence: 40,
    reason: 'Insufficient data to determine type'
  };
};

export const validatePhoneNumber = (phone: string): boolean => {
  if (!phone) return true; // Optional field
  
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, '');
  
  // Check if it's a valid phone number (7-15 digits)
  return /^\d{7,15}$/.test(cleaned);
};

export const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return '';
  return phone.trim();
};
