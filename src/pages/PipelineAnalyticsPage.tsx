import { PipelineAnalyticsDashboard } from '@/components/pipeline';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, Calendar } from 'lucide-react';
import { usePipelineAnalytics } from '@/hooks/use-pipeline-analytics';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PipelineAnalyticsPage() {
  const [dateRange, setDateRange] = useState('90');
  const { refetch, isLoading } = usePipelineAnalytics();

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export pipeline data');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline Analytics</h1>
          <p className="text-muted-foreground">
            Track deal velocity, conversion rates, and pipeline health
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Dashboard */}
      <PipelineAnalyticsDashboard />
    </div>
  );
}
