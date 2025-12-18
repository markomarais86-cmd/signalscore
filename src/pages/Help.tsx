import { useState, ReactElement } from 'react';
import { 
  Search, 
  BookOpen, 
  Video, 
  MessageCircle, 
  ChevronRight,
  Target,
  Database,
  Bot,
  Upload,
  Settings,
  TrendingUp,
  Users,
  Zap,
  ExternalLink,
  ArrowLeft,
  X
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { helpDatabase, videoTutorials, HelpItem } from '@/components/help/helpContent';

// Simple markdown renderer for help content
function renderMarkdown(content: string) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  const processInlineMarkdown = (text: string): React.ReactNode => {
    // Handle bold, italic, inline code, and links
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyCounter = 0;

    while (remaining.length > 0) {
      // Bold **text**
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      // Inline code `code`
      const codeMatch = remaining.match(/`([^`]+)`/);
      // Link [text](url)
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

      let firstMatch: { type: string; index: number; match: RegExpMatchArray } | null = null;

      if (boldMatch && boldMatch.index !== undefined) {
        if (!firstMatch || boldMatch.index < firstMatch.index) {
          firstMatch = { type: 'bold', index: boldMatch.index, match: boldMatch };
        }
      }
      if (codeMatch && codeMatch.index !== undefined) {
        if (!firstMatch || codeMatch.index < firstMatch.index) {
          firstMatch = { type: 'code', index: codeMatch.index, match: codeMatch };
        }
      }
      if (linkMatch && linkMatch.index !== undefined) {
        if (!firstMatch || linkMatch.index < firstMatch.index) {
          firstMatch = { type: 'link', index: linkMatch.index, match: linkMatch };
        }
      }

      if (!firstMatch) {
        parts.push(remaining);
        break;
      }

      if (firstMatch.index > 0) {
        parts.push(remaining.slice(0, firstMatch.index));
      }

      if (firstMatch.type === 'bold') {
        parts.push(<strong key={keyCounter++}>{firstMatch.match[1]}</strong>);
        remaining = remaining.slice(firstMatch.index + firstMatch.match[0].length);
      } else if (firstMatch.type === 'code') {
        parts.push(
          <code key={keyCounter++} className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono">
            {firstMatch.match[1]}
          </code>
        );
        remaining = remaining.slice(firstMatch.index + firstMatch.match[0].length);
      } else if (firstMatch.type === 'link') {
        parts.push(
          <a key={keyCounter++} href={firstMatch.match[2]} className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">
            {firstMatch.match[1]}
          </a>
        );
        remaining = remaining.slice(firstMatch.index + firstMatch.match[0].length);
      }
    }

    return <>{parts}</>;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Code blocks
    if (trimmedLine.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={i} className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
            <code className="text-sm font-mono">{codeContent.join('\n')}</code>
          </pre>
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Tables
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      const cells = trimmedLine.slice(1, -1).split('|').map(c => c.trim());
      
      // Skip separator row
      if (cells.every(c => c.match(/^[-:]+$/))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      // End of table
      elements.push(
        <div key={i} className="overflow-x-auto my-4">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {tableHeaders.map((h, idx) => (
                  <th key={idx} className="border border-border px-4 py-2 bg-muted text-left font-semibold">
                    {processInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="border border-border px-4 py-2">
                      {processInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }

    // Empty line
    if (!trimmedLine) {
      continue;
    }

    // Headers
    if (trimmedLine.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold mt-6 mb-4 first:mt-0">
          {trimmedLine.slice(2)}
        </h1>
      );
      continue;
    }
    if (trimmedLine.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-xl font-semibold mt-6 mb-3">
          {trimmedLine.slice(3)}
        </h2>
      );
      continue;
    }
    if (trimmedLine.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-lg font-semibold mt-4 mb-2">
          {trimmedLine.slice(4)}
        </h3>
      );
      continue;
    }

    // List items
    if (trimmedLine.match(/^[-*] /)) {
      elements.push(
        <li key={i} className="ml-6 list-disc text-muted-foreground">
          {processInlineMarkdown(trimmedLine.slice(2))}
        </li>
      );
      continue;
    }

    // Numbered lists
    if (trimmedLine.match(/^\d+\. /)) {
      const content = trimmedLine.replace(/^\d+\. /, '');
      elements.push(
        <li key={i} className="ml-6 list-decimal text-muted-foreground">
          {processInlineMarkdown(content)}
        </li>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-muted-foreground mb-3">
        {processInlineMarkdown(trimmedLine)}
      </p>
    );
  }

  // Close any remaining table
  if (inTable && tableHeaders.length > 0) {
    elements.push(
      <div key="final-table" className="overflow-x-auto my-4">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {tableHeaders.map((h, idx) => (
                <th key={idx} className="border border-border px-4 py-2 bg-muted text-left font-semibold">
                  {processInlineMarkdown(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="border border-border px-4 py-2">
                    {processInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return elements;
}

const categories = [
  { id: 'getting-started', name: 'Getting Started', icon: Zap, color: 'text-green-500' },
  { id: 'icp-scoring', name: 'ICP & Scoring', icon: Target, color: 'text-blue-500' },
  { id: 'accounts', name: 'Accounts', icon: Database, color: 'text-purple-500' },
  { id: 'contacts', name: 'Contacts', icon: Users, color: 'text-orange-500' },
  { id: 'ai-agents', name: 'AI Agents', icon: Bot, color: 'text-pink-500' },
  { id: 'data-upload', name: 'Data Upload', icon: Upload, color: 'text-cyan-500' },
  { id: 'integrations', name: 'Integrations', icon: Settings, color: 'text-yellow-500' },
  { id: 'analytics', name: 'Analytics', icon: TrendingUp, color: 'text-red-500' },
];

const faqs = [
  {
    question: 'How do I create my first ICP?',
    answer: 'Navigate to ICP Manager and click "Create ICP". You can define your ideal customer profile by specifying industries, company sizes, geographies, and other criteria. The AI will help you refine your criteria based on your best customers.',
  },
  {
    question: 'What is a propensity score?',
    answer: 'The propensity score (0-100) predicts how likely an account is to convert. It combines ICP fit (how well they match your ideal customer) and intent signals (engagement, buying signals) to prioritize your outreach.',
  },
  {
    question: 'How do I import my data?',
    answer: 'Go to Settings > Data Upload. You can upload CSV files with your accounts and contacts. The system will automatically map fields and enrich your data. We also support direct CRM integrations.',
  },
  {
    question: 'What are AI Agents?',
    answer: 'AI Agents automate repetitive tasks like data enrichment, lead scoring, and contact discovery. They run on schedules you define and can process thousands of records automatically.',
  },
  {
    question: 'How does the AI Chat work?',
    answer: 'The AI Chat (⌘K) understands natural language queries about your data. Ask questions like "Find tech companies in California with CTOs" or "Show me high-fit accounts that need enrichment" and it will execute the appropriate actions.',
  },
  {
    question: 'Can I export my data?',
    answer: 'Yes! From the Accounts or Contacts pages, you can select records and export them to CSV. You can also sync directly to your CRM or marketing automation platform.',
  },
];

export default function Help() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<HelpItem | null>(null);

  // Get the previous path for back navigation
  const fromPath = (location.state as any)?.from || '/';

  // Filter help items by search and category
  const filteredHelp = helpDatabase.filter(item => {
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !activeCategory || 
      item.category.toLowerCase().replace(/\s+/g, '-') === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedHelp = filteredHelp.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof helpDatabase>);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container max-w-6xl py-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(fromPath)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Help & Documentation</h1>
              <p className="text-muted-foreground">
                Everything you need to know about LaunchPulse
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-6xl py-8">
        <Tabs defaultValue="docs" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="docs" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Documentation
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="faq" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              FAQ
            </TabsTrigger>
          </TabsList>

          {/* Documentation Tab */}
          <TabsContent value="docs" className="space-y-6">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(null)}
              >
                All Topics
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory(cat.id)}
                  className="flex items-center gap-2"
                >
                  <cat.icon className={`h-4 w-4 ${activeCategory !== cat.id ? cat.color : ''}`} />
                  {cat.name}
                </Button>
              ))}
            </div>

            {/* Help Articles */}
            {Object.keys(groupedHelp).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No results found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search or browse all topics
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {Object.entries(groupedHelp).map(([category, items]) => (
                  <div key={category}>
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      {categories.find(c => c.name === category)?.icon && (
                        (() => {
                          const IconComponent = categories.find(c => c.name === category)?.icon;
                          const colorClass = categories.find(c => c.name === category)?.color;
                          return IconComponent ? <IconComponent className={`h-5 w-5 ${colorClass}`} /> : null;
                        })()
                      )}
                      {category}
                    </h2>
                    <div className="grid gap-3">
                      {items.map(item => (
                        <Card 
                          key={item.id} 
                          className="hover:border-primary/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedArticle(item)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-base">{item.title}</CardTitle>
                                <CardDescription className="mt-1">
                                  {item.description}
                                </CardDescription>
                              </div>
                              {item.videoUrl && (
                                <Badge variant="secondary" className="shrink-0">
                                  <Video className="h-3 w-3 mr-1" />
                                  Video
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {item.description}
                            </p>
                            <Button variant="link" className="px-0 mt-2 text-primary">
                              Read more <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos" className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videoTutorials.map(video => (
                <Card key={video.id} className="overflow-hidden hover:border-primary/50 transition-colors">
                  <div className="aspect-video bg-muted relative">
                    {video.thumbnailUrl ? (
                      <img 
                        src={video.thumbnailUrl} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="bg-background/80">
                      {video.duration}
                    </Badge>
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{video.title}</CardTitle>
                  <CardDescription>{video.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href={video.videoUrl} target="_blank" rel="noopener noreferrer">
                      <Video className="h-4 w-4 mr-2" />
                      Watch Video
                      <ExternalLink className="h-3 w-3 ml-2" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {videoTutorials.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center">
                    <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No videos yet</h3>
                    <p className="text-muted-foreground">
                      Video tutorials are coming soon
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
                <CardDescription>
                  Quick answers to common questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Contact Support */}
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Still need help?</h3>
                    <p className="text-sm text-muted-foreground">
                      Use the AI Chat (⌘K) to ask questions about your data
                    </p>
                  </div>
                  <Button onClick={() => {
                    // Dispatch custom event to open AI chat
                    window.dispatchEvent(new CustomEvent('openAIChat'));
                  }}>
                    Open AI Chat
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Article Detail Dialog */}
      <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-start justify-between pr-8">
              <div>
                <Badge variant="secondary" className="mb-2">
                  {selectedArticle?.category}
                </Badge>
                <DialogTitle className="text-xl">{selectedArticle?.title}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedArticle?.description}
                </p>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="py-4">
              {selectedArticle && renderMarkdown(selectedArticle.content)}
            </div>
          </ScrollArea>
          {selectedArticle?.relatedPages && selectedArticle.relatedPages.length > 0 && (
            <div className="shrink-0 border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-2">Related Pages</p>
              <div className="flex flex-wrap gap-2">
                {selectedArticle.relatedPages.map((page, idx) => (
                  <Button 
                    key={idx} 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedArticle(null);
                      navigate(page);
                    }}
                  >
                    {page === '/' ? 'Dashboard' : page.replace('/', '').replace(/-/g, ' ')}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
