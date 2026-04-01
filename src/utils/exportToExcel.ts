import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExportOptions {
  orgId: string;
  includeAccounts?: boolean;
  includeContacts?: boolean;
  includeDeals?: boolean;
  includeScores?: boolean;
}

function applyHeaderStyle(ws: XLSX.WorkSheet, range: XLSX.Range) {
  // xlsx community edition doesn't support cell styles natively,
  // but we set column widths for readability
  if (!range) return;
  const cols: XLSX.ColInfo[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    cols.push({ wch: 20 });
  }
  ws['!cols'] = cols;
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportToExcel(options: ExportOptions): Promise<void> {
  const {
    orgId,
    includeAccounts = true,
    includeContacts = true,
    includeDeals = true,
    includeScores = true,
  } = options;

  toast.info('Generating Excel report...');

  try {
    const wb = XLSX.utils.book_new();

    // Fetch data in parallel
    const promises: Promise<void>[] = [];

    // === Accounts Sheet ===
    if (includeAccounts) {
      promises.push(
        (async () => {
          const { data, error } = await supabase
            .from('accounts')
            .select('external_id, name, domain, industry_norm, industry_raw, employee_count, revenue_range, country, city, state_province, tech_stack, founded_year, data_source, enriched_at, icp_qualified, propensity_score, updated_at')
            .eq('org_id', orgId)
            .order('name')
            .limit(5000);

          if (error) throw error;
          if (!data || data.length === 0) return;

          const rows = data.map(a => ({
            'External ID': a.external_id,
            'Company Name': a.name || '',
            'Domain': a.domain || '',
            'Industry': a.industry_norm || a.industry_raw || '',
            'Sub-Industry': a.industry_raw || '',
            'Employees': a.employee_count || '',
            'Revenue Range': a.revenue_range || '',
            'Country': a.country || '',
            'City': a.city || '',
            'State': a.state_province || '',
            'Tech Stack': (a.tech_stack || []).join(', '),
            'Founded': a.founded_year || '',
            'Data Source': a.data_source || '',
            'ICP Qualified': a.icp_qualified ? 'Yes' : a.icp_qualified === false ? 'No' : '',
            'Propensity Score': a.propensity_score || '',
            'Enriched At': a.enriched_at ? new Date(a.enriched_at).toLocaleDateString() : '',
            'Last Updated': a.updated_at ? new Date(a.updated_at).toLocaleDateString() : '',
          }));

          const ws = XLSX.utils.json_to_sheet(rows);
          const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
          applyHeaderStyle(ws, range);
          XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
        })()
      );
    }

    // === Contacts Sheet ===
    if (includeContacts) {
      promises.push(
        (async () => {
          const { data, error } = await supabase
            .from('Leads')
            .select('external_id, first_name, last_name, email, title_raw, title_normalized, seniority_level, department, phone, mobile, linkedin_url, account_external_id, status, lead_source, data_source')
            .eq('org_id', orgId)
            .order('last_name')
            .limit(10000);

          if (error) throw error;
          if (!data || data.length === 0) return;

          const rows = data.map(c => ({
            'External ID': c.external_id || '',
            'First Name': c.first_name || '',
            'Last Name': c.last_name || '',
            'Email': c.email || '',
            'Title': c.title_raw || c.title_normalized || '',
            'Seniority': c.seniority_level || '',
            'Department': c.department || '',
            'Phone': c.phone || '',
            'Mobile': c.mobile || '',
            'LinkedIn': c.linkedin_url || '',
            'Account ID': c.account_external_id || '',
            'Status': c.status || '',
            'Lead Source': c.lead_source || '',
            'Data Source': c.data_source || '',
          }));

          const ws = XLSX.utils.json_to_sheet(rows);
          const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
          applyHeaderStyle(ws, range);
          XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
        })()
      );
    }

    // === Deals Sheet ===
    if (includeDeals) {
      promises.push(
        (async () => {
          const { data, error } = await supabase
            .from('deals')
            .select('external_id, name, stage, amount, close_date, owner_name, account_external_id, loss_reason, created_at, updated_at')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(5000);

          if (error) throw error;
          if (!data || data.length === 0) return;

          const rows = data.map(d => ({
            'Deal ID': d.external_id || '',
            'Deal Name': d.name || '',
            'Stage': d.stage || '',
            'Amount': d.amount || '',
            'Close Date': d.close_date ? new Date(d.close_date).toLocaleDateString() : '',
            'Owner': d.owner_name || '',
            'Account ID': d.account_external_id || '',
            'Loss Reason': d.loss_reason || '',
            'Created': d.created_at ? new Date(d.created_at).toLocaleDateString() : '',
            'Updated': d.updated_at ? new Date(d.updated_at).toLocaleDateString() : '',
          }));

          const ws = XLSX.utils.json_to_sheet(rows);
          const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
          applyHeaderStyle(ws, range);
          XLSX.utils.book_append_sheet(wb, ws, 'Deals');
        })()
      );
    }

    // === Scores Sheet ===
    if (includeScores) {
      promises.push(
        (async () => {
          const { data, error } = await supabase
            .from('scores')
            .select('account_external_id, icp_id, overall_score, fit_score, intent_score, reachability_score, band, scored_at, version')
            .eq('org_id', orgId)
            .order('overall_score', { ascending: false })
            .limit(10000);

          if (error) throw error;
          if (!data || data.length === 0) return;

          const rows = data.map(s => ({
            'Account ID': s.account_external_id,
            'ICP Profile': s.icp_id || '',
            'Overall Score': s.overall_score,
            'Fit Score': s.fit_score,
            'Intent Score': s.intent_score,
            'Reachability': s.reachability_score,
            'Band': s.band || '',
            'Scored At': s.scored_at ? new Date(s.scored_at).toLocaleDateString() : '',
            'Version': s.version || '',
          }));

          const ws = XLSX.utils.json_to_sheet(rows);
          const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
          applyHeaderStyle(ws, range);
          XLSX.utils.book_append_sheet(wb, ws, 'Scores');
        })()
      );
    }

    // === Summary Sheet ===
    promises.push(
      (async () => {
        const { count: accountCount } = await supabase
          .from('accounts')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId);

        const { count: contactCount } = await supabase
          .from('Leads')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId);

        const { count: dealCount } = await supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId);

        const { count: scoreCount } = await supabase
          .from('scores')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId);

        const summaryData = [
          ['LaunchPulse Data Export'],
          ['Generated', new Date().toLocaleString()],
          [''],
          ['Summary'],
          ['Metric', 'Count'],
          ['Total Accounts', accountCount || 0],
          ['Total Contacts', contactCount || 0],
          ['Total Deals', dealCount || 0],
          ['Total Scores', scoreCount || 0],
        ];

        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        ws['!cols'] = [{ wch: 25 }, { wch: 30 }];
        // Insert Summary as first sheet
        XLSX.utils.book_append_sheet(wb, ws, 'Summary');
      })()
    );

    await Promise.all(promises);

    // Reorder so Summary is first
    if (wb.SheetNames.includes('Summary')) {
      const idx = wb.SheetNames.indexOf('Summary');
      wb.SheetNames.splice(idx, 1);
      wb.SheetNames.unshift('Summary');
    }

    const dateStr = new Date().toISOString().split('T')[0];
    downloadWorkbook(wb, `launchpulse-export-${dateStr}.xlsx`);
    toast.success('Excel report downloaded!');
  } catch (err: any) {
    console.error('Excel export error:', err);
    toast.error(err.message || 'Failed to generate Excel report');
  }
}
