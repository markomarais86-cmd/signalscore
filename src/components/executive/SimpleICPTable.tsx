import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Database, Cloud } from "lucide-react";

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

  const data = [
    {
      source: "CRM",
      icon: Cloud,
      total: crmAccounts,
      highFit: highFitCrmAccounts,
      percentage: crmPercentage,
    },
    {
      source: "Database",
      icon: Database,
      total: databaseAccounts,
      highFit: highFitDatabaseAccounts,
      percentage: databasePercentage,
    },
  ];

  return (
    <Card className={`${className} border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/20 transition-colors duration-300`}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">ICP Coverage by Source</span>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-32 text-xs font-medium text-muted-foreground">Source</TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground">Total</TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground">High-Fit</TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground">Coverage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.source} className="border-border/50 hover:bg-muted/30 transition-colors">
                <TableCell className="py-4">
                  <div className="flex items-center gap-2">
                    <row.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{row.source}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-foreground font-medium">
                  {row.total.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-foreground font-medium">
                  {row.highFit.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20">
                    {row.percentage}% High-Fit
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
