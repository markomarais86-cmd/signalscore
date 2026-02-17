import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Target, Users, Building, MapPin, TrendingUp } from 'lucide-react';
import { LaunchPulseMark } from "@/components/BrandLogo";
import { supabase } from '@/integrations/supabase/client';
import { ICPTemplate, ICPFormData } from '@/types/icp';
import { ICP_TEMPLATES_CATEGORIES } from '@/constants/icp';

interface ICPTemplateSelectorProps {
  onSelectTemplate: (template: ICPTemplate, formData: ICPFormData) => void;
  onSkip: () => void;
  onSelectClosedWon?: () => void;
  onUseSmartDefaults?: () => void;
  hasAccountData?: boolean;
  accountInsights?: {
    topIndustries: Array<{ name: string; count: number }>;
    topSizes: Array<{ size: number; count: number }>;
    topCountries: Array<{ name: string; count: number }>;
    totalAccounts: number;
    hasData: boolean;
  };
}

export function ICPTemplateSelector({ onSelectTemplate, onSkip, onSelectClosedWon, onUseSmartDefaults, hasAccountData, accountInsights }: ICPTemplateSelectorProps) {
  const [templates, setTemplates] = useState<ICPTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('icp_templates')
        .select('*')
        .eq('is_public', true)
        .order('category', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const convertTemplateToFormData = (template: ICPTemplate): ICPFormData => {
    return {
      name: template.name,
      description: template.description || '',
      use_case: template.use_cases?.[0] || '',
      
      // Basic targeting
      industries: template.industries || [],
      sub_industries: template.sub_industries || [],
      company_sizes: template.company_sizes || [],
      revenue_ranges: template.revenue_ranges || [],
      geographies: template.geographies || [],
      
      // Persona targeting
      persona_job_titles: template.persona_job_titles || [],
      persona_seniority_levels: template.persona_seniority_levels || [],
      persona_departments: template.persona_departments || [],
      persona_decision_roles: [],
      
      // Company classification
      company_stages: template.company_stages || [],
      tech_stack: template.tech_stack || [],
      growth_stage: [],
      funding_status: [],
      
      // Advanced geographic
      regions: [],
      cities: [],
      timezones: [],
      
      // Intent and signals
      intent_signals: [],
      buying_triggers: [],
      
      // Exclusions
      excluded_companies: [],
      excluded_industries: [],
      
      // Patterns and budget
      seasonal_patterns: [],
      budget_indicators: [],
      
      // Company keywords
      company_keywords: [],
      
      // Metadata
      tags: [],
      status: 'draft' as const
    };
  };

  const handleSelectTemplate = (template: ICPTemplate) => {
    const formData = convertTemplateToFormData(template);
    onSelectTemplate(template, formData);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="animate-pulse">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Choose an ICP Template</h2>
        <p className="text-muted-foreground">
          Start with a pre-built template or create from scratch
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {ICP_TEMPLATES_CATEGORIES.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Create from Closed Won Data - Featured Option */}
        {onSelectClosedWon && (
          <Card className="border-2 border-primary cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br from-primary/5 to-transparent" onClick={onSelectClosedWon}>
            <CardContent className="flex flex-col items-center justify-center py-8 relative">
              <Badge className="absolute top-3 right-3 bg-primary">Recommended</Badge>
              <LaunchPulseMark className="h-8 w-8" />
              <CardTitle className="text-lg text-center">Create from Wins</CardTitle>
              <CardDescription className="text-center mt-1">
                AI-generated ICP based on your closed won deals
              </CardDescription>
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Data-driven insights
              </div>
            </CardContent>
          </Card>
        )}

        {/* Smart Defaults from Account Data */}
        {hasAccountData && onUseSmartDefaults && accountInsights && (
          <Card 
            className="border-2 border-blue-500 cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br from-blue-500/10 to-transparent" 
            onClick={onUseSmartDefaults}
          >
            <CardContent className="flex flex-col items-center justify-center py-8 relative">
              <Badge className="absolute top-3 right-3 bg-blue-600">Smart</Badge>
              <LaunchPulseMark className="h-8 w-8" />
              <CardTitle className="text-lg text-center">Auto-Generate from Data</CardTitle>
              <CardDescription className="text-center mt-1 px-2">
                Pre-fill based on your {accountInsights.totalAccounts.toLocaleString()} accounts
              </CardDescription>
              <div className="mt-3 flex flex-wrap gap-1 justify-center text-xs text-muted-foreground">
                <span>{accountInsights.topIndustries.length} industries</span>
                <span>•</span>
                <span>{accountInsights.topCountries.length} countries</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create from scratch option */}
        <Card className="border-dashed cursor-pointer hover:border-primary transition-colors" onClick={onSkip}>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Target className="h-8 w-8 text-muted-foreground mb-2" />
            <CardTitle className="text-lg text-center">Start from Scratch</CardTitle>
            <CardDescription className="text-center mt-1">
              Create a custom ICP profile
            </CardDescription>
          </CardContent>
        </Card>

        {/* Template cards */}
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleSelectTemplate(template)}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <Badge variant="outline" className="mt-1">
                    {template.category}
                  </Badge>
                </div>
                <Target className="h-5 w-5 text-primary" />
              </div>
              {template.description && (
                <CardDescription className="mt-2">
                  {template.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {template.industries && template.industries.length > 0 && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {template.industries.slice(0, 2).map((industry, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {industry}
                      </Badge>
                    ))}
                    {template.industries.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{template.industries.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {template.company_sizes && template.company_sizes.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {template.company_sizes.slice(0, 2).map((size, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {size}+ employees
                      </Badge>
                    ))}
                    {template.company_sizes.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{template.company_sizes.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {template.geographies && template.geographies.length > 0 && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {template.geographies.slice(0, 2).map((geo, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {geo}
                      </Badge>
                    ))}
                    {template.geographies.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{template.geographies.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No templates found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search or category filter
          </p>
          <Button variant="outline" onClick={onSkip}>
            Create from Scratch
          </Button>
        </div>
      )}
    </div>
  );
}