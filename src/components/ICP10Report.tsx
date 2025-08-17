import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Crown, Download, Users, Building, MapPin, Briefcase } from "lucide-react";
import { SignalScoreDisplay } from "@/components/SignalScoreDisplay";

interface ICP10Entry {
  rank: number;
  persona: string;
  subIndustry: string;
  country: string;
  companySize: string;
  revenueRange: string;
  employeeRange: string;
  signalScore: number;
  accountCount: number;
  tamValue: number;
  conversionRate: number;
  avgDealSize: number;
  salesCycle: number;
}

interface ICP10ReportProps {
  data: ICP10Entry[];
  onExport?: (format: 'pdf' | 'csv') => void;
}

export function ICP10Report({ data, onExport }: ICP10ReportProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank <= 3) return "bg-gradient-to-r from-yellow-400 to-yellow-600";
    if (rank <= 6) return "bg-gradient-to-r from-gray-300 to-gray-500";
    return "bg-gradient-to-r from-orange-400 to-orange-600";
  };

  const totalTAM = data.reduce((sum, item) => sum + item.tamValue, 0);
  const totalAccounts = data.reduce((sum, item) => sum + item.accountCount, 0);
  const avgSignalScore = Math.round(data.reduce((sum, item) => sum + item.signalScore, 0) / data.length);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <CardTitle>ICP-10 Board Report</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onExport?.('csv')}
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onExport?.('pdf')}
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              PDF
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-[hsl(var(--primary))]">
              {formatCurrency(totalTAM)}
            </div>
            <div className="text-sm text-muted-foreground">Total ICP-10 TAM</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{totalAccounts.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Accounts</div>
          </div>
          <div className="text-center">
            <SignalScoreDisplay score={avgSignalScore} size="sm" />
            <div className="text-sm text-muted-foreground mt-1">Avg Score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>ICP Segment</TableHead>
                <TableHead>Geography</TableHead>
                <TableHead>Company Size</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>TAM</TableHead>
                <TableHead>Conversion</TableHead>
                <TableHead>Deal Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((entry) => (
                <TableRow key={entry.rank}>
                  <TableCell>
                    <Badge className={`text-white ${getRankBadgeColor(entry.rank)}`}>
                      #{entry.rank}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-sm">{entry.persona}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{entry.subIndustry}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{entry.country}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{entry.revenueRange}</div>
                      <div className="text-xs text-muted-foreground">{entry.employeeRange} employees</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <SignalScoreDisplay 
                      score={entry.signalScore} 
                      size="sm" 
                      showLabel={false}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium text-[hsl(var(--primary))]">
                        {formatCurrency(entry.tamValue)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.accountCount.toLocaleString()} accounts
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{entry.conversionRate}%</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{formatCurrency(entry.avgDealSize)}</div>
                      <div className="text-xs text-muted-foreground">{entry.salesCycle}d cycle</div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}