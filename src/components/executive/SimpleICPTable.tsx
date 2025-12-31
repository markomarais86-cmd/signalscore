import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SimpleICPTableProps {
  crmAccounts: number;
  databaseAccounts: number;
  highFitCrmAccounts: number;
  highFitDatabaseAccounts: number;
  className?: string;
}

export function SimpleICPTable({
  crmAccounts,
  databaseAccounts,
  highFitCrmAccounts,
  highFitDatabaseAccounts,
  className,
}: SimpleICPTableProps) {
  const crmPercentage = crmAccounts > 0 
    ? Math.round((highFitCrmAccounts / crmAccounts) * 100) 
    : 0;
  
  const databasePercentage = databaseAccounts > 0 
    ? Math.round((highFitDatabaseAccounts / databaseAccounts) * 100) 
    : 0;

  const rows = [
    {
      source: "CRM",
      total: crmAccounts,
      highFit: highFitCrmAccounts,
      percentage: crmPercentage,
    },
    {
      source: "Database",
      total: databaseAccounts,
      highFit: highFitDatabaseAccounts,
      percentage: databasePercentage,
    },
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">ICP Coverage</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-muted-foreground font-medium">Source</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right">Total</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right">High-Fit</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.source} className="border-border/30">
                <TableCell className="font-medium">{row.source}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.total.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.highFit.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Badge 
                    variant="secondary" 
                    className="bg-primary/20 text-primary border-0 font-medium"
                  >
                    {row.percentage}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
