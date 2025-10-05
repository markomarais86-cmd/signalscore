import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface EnrichedAccount {
  name: string;
  enriched_from: string;
  enriched_at: string;
  employee_count: number | null;
  revenue_range: string | null;
  industry_norm: string | null;
  country: string | null;
  quality_score: number;
}

export function EnrichmentAttributionReport() {
  const [accounts, setAccounts] = useState<EnrichedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.user_metadata?.organization_id) {
      loadEnrichedAccounts();
    }
  }, [user]);

  const loadEnrichedAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("name, enriched_from, enriched_at, employee_count, revenue_range, industry_norm, country")
        .not("enriched_from", "is", null)
        .order("enriched_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const enrichedWithScores = (data || []).map(account => ({
        ...account,
        quality_score: calculateQualityScore(account)
      }));

      setAccounts(enrichedWithScores);
    } catch (error) {
      console.error("Error loading enriched accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateQualityScore = (account: any): number => {
    let score = 0;
    if (account.industry_norm) score += 25;
    if (account.employee_count) score += 25;
    if (account.revenue_range) score += 25;
    if (account.country) score += 25;
    return score;
  };

  const getProviderBadge = (provider: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      clearbit: "default",
      ai: "secondary",
      pdl: "outline"
    };
    
    return (
      <Badge variant={variants[provider.toLowerCase()] || "secondary"} className="text-xs">
        {provider === "clearbit" ? "CB" : provider.toUpperCase()}
      </Badge>
    );
  };

  const getFieldsBadges = (account: EnrichedAccount) => {
    const fields = [];
    if (account.industry_norm) fields.push("Industry");
    if (account.employee_count) fields.push("Employees");
    if (account.revenue_range) fields.push("Revenue");
    if (account.country) fields.push("Country");
    return fields;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Enrichment Attribution Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Enrichment Attribution Report
        </CardTitle>
        <CardDescription>
          Track which providers enriched which accounts and fields
        </CardDescription>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No enriched accounts yet
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Provider(s)</TableHead>
                  <TableHead>Fields Enriched</TableHead>
                  <TableHead>Quality Score</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {account.enriched_from?.split(",").map((provider, i) => (
                          <span key={i}>{getProviderBadge(provider.trim())}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getFieldsBadges(account).map((field, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${account.quality_score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{account.quality_score}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(account.enriched_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
