import { useState } from "react";
import type { ValidationResult, ValidationIssue, DataQualityScore, FieldAnalysis } from "@/components/data-upload/DataValidationReport";
import type { FieldMapping } from "@/components/data-upload/FieldMappingDialog";

export function useCSVValidator() {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const detectDuplicates = (
    rawData: any[], 
    mapping: FieldMapping, 
    type: 'accounts' | 'contacts' | 'leads', 
    issues: ValidationIssue[]
  ): number => {
    const keyField = 'external_id';
    const csvKeyField = Object.keys(mapping).find(key => mapping[key] === keyField);
    
    if (!csvKeyField) return 0;
    
    const seenValues = new Set<string>();
    let duplicateCount = 0;
    
    rawData.forEach((row, index) => {
      const keyValue = row[csvKeyField];
      if (keyValue) {
        if (seenValues.has(keyValue)) {
          duplicateCount++;
          issues.push({
            row: index + 2,
            field: csvKeyField,
            type: 'warning',
            message: 'Duplicate identifier found',
            value: keyValue,
            suggestion: 'Ensure all IDs are unique or the later entry will overwrite the earlier one'
          });
        } else {
          seenValues.add(keyValue);
        }
      }
    });
    
    return duplicateCount;
  };

  const validateDataWithMapping = (
    rawData: any[], 
    mapping: FieldMapping, 
    type: 'accounts' | 'contacts' | 'leads'
  ): ValidationResult => {
    const issues: ValidationIssue[] = [];
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    
    // Field analysis
    const fieldAnalysis: FieldAnalysis[] = [];
    const mappedFields = Object.values(mapping).filter(Boolean);
    
    mappedFields.forEach(field => {
      if (!field) return;
      
      const csvField = Object.keys(mapping).find(key => mapping[key] === field);
      if (!csvField) return;
      
      const values = rawData.map(row => row[csvField]).filter(v => v !== null && v !== undefined && v !== '');
      const uniqueValues = [...new Set(values)];
      const completeness = Number(((values.length / rawData.length) * 100).toFixed(2));
      
      const analysis: FieldAnalysis = {
        field: csvField,
        completeness,
        uniqueValues: uniqueValues.length,
        commonValues: [],
        dataType: 'string',
        issues: []
      };
      
      // Detect data type
      if (field === 'employee_count') {
        analysis.dataType = 'number';
        values.forEach((val, idx) => {
          if (val && isNaN(Number(val))) {
            analysis.issues.push(`Row ${idx + 2}: "${val}" is not a valid number`);
          }
        });
      } else if (field === 'email') {
        analysis.dataType = 'email';
        values.forEach((val, idx) => {
          if (val && !val.includes('@')) {
            analysis.issues.push(`Row ${idx + 2}: "${val}" is not a valid email`);
          }
        });
      }
      
      // Get common values
      const valueCounts = values.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      analysis.commonValues = Object.entries(valueCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([value, count]) => ({ value, count: count as number }));
      
      fieldAnalysis.push(analysis);
    });

    // Validate each row
    rawData.forEach((row, index) => {
      let rowHasErrors = false;
      let rowHasWarnings = false;

      Object.entries(mapping).forEach(([csvField, schemaField]: [string, string]) => {
        if (!schemaField) return;
        
        const value = row[csvField];
        const rowNum = index + 2;

        // Check required fields
        if (type === 'accounts' && schemaField === 'external_id' && !value) {
          issues.push({
            row: rowNum,
            field: csvField,
            type: 'error',
            message: 'External ID is required',
            value: value,
            suggestion: 'Provide a unique identifier for this account'
          });
          rowHasErrors = true;
        }

        if (type === 'contacts' && (schemaField === 'external_id' || schemaField === 'account_external_id') && !value) {
          issues.push({
            row: rowNum,
            field: csvField,
            type: 'error',
            message: `${schemaField === 'external_id' ? 'Contact ID' : 'Account ID'} is required`,
            value: value,
            suggestion: 'Provide a unique identifier'
          });
          rowHasErrors = true;
        }

        // Validate data types
        if (value && schemaField === 'employee_count' && isNaN(Number(value))) {
          issues.push({
            row: rowNum,
            field: csvField,
            type: 'error',
            message: 'Employee count must be a number',
            value: value,
            suggestion: 'Use numeric values only (e.g., 100, 500)'
          });
          rowHasErrors = true;
        }

        // Email validation
        if (value && schemaField === 'email' && !value.includes('@')) {
          issues.push({
            row: rowNum,
            field: csvField,
            type: 'warning',
            message: 'Invalid email format',
            value: value,
            suggestion: 'Check email format (should contain @)'
          });
          rowHasWarnings = true;
        }

        // Missing important fields (warnings)
        if (!value && ['name', 'domain', 'industry_raw', 'first_name', 'last_name'].includes(schemaField)) {
          issues.push({
            row: rowNum,
            field: csvField,
            type: 'warning',
            message: 'Missing recommended field',
            value: value,
            suggestion: 'Consider adding this information for better scoring'
          });
          rowHasWarnings = true;
        }
      });

      if (rowHasErrors) {
        errorCount++;
      } else if (rowHasWarnings) {
        warningCount++;
      } else {
        validCount++;
      }
    });

    // Calculate data quality scores
    const totalFields = Object.keys(mapping).length;
    const filledFields = rawData.reduce((sum, row) => {
      return sum + Object.keys(mapping).filter(field => row[field]).length;
    }, 0);
    
    const duplicateCount = detectDuplicates(rawData, mapping, type, issues);
    
    const completeness = Number(((filledFields / (rawData.length * totalFields)) * 100).toFixed(2));
    const accuracy = Number((((validCount + warningCount) / rawData.length) * 100).toFixed(2));
    const consistency = Number((100 - (issues.filter(i => i.message.includes('format')).length / rawData.length) * 100).toFixed(2));
    
    const dataQuality: DataQualityScore = {
      overall: Math.round((completeness + accuracy + consistency) / 3),
      completeness: Math.round(completeness),
      accuracy: Math.round(accuracy),
      consistency: Math.round(consistency),
      details: {
        missingValues: rawData.length * totalFields - filledFields,
        invalidFormats: issues.filter(i => i.message.includes('format')).length,
        duplicates: duplicateCount
      }
    };

    const result = {
      total: rawData.length,
      valid: validCount,
      warnings: warningCount,
      errors: errorCount,
      issues,
      dataQuality,
      fieldAnalysis
    };

    setValidationResult(result);
    return result;
  };

  return {
    validationResult,
    validateDataWithMapping,
    setValidationResult
  };
}
