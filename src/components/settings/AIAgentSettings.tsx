import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Bot, 
  Plus, 
  Settings as SettingsIcon,
  Play,
  Pause,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Agent {
  id: string;
  name: string;
  type: 'lead_qualification' | 'meeting_scheduling' | 'follow_up' | 'data_enrichment';
  description: string;
  parameters: any;
  enabled: boolean;
  schedule: {
    frequency: 'continuous' | 'hourly' | 'daily' | 'weekly';
    time?: string;
    days?: string[];
  };
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'inactive' | 'error';
  isDefault: boolean;
}

interface AgentTemplate {
  type: Agent['type'];
  name: string;
  description: string;
  defaultParameters: any;
  icon: any;
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    type: 'lead_qualification',
    name: 'Lead Qualification',
    description: 'Automatically score and qualify leads based on criteria',
    icon: Bot,
    defaultParameters: {
      min_score_threshold: 70,
      auto_assign: true,
      notification_enabled: true
    }
  },
  {
    type: 'meeting_scheduling',
    name: 'Meeting Scheduling',
    description: 'Schedule meetings with qualified prospects',
    icon: Calendar,
    defaultParameters: {
      calendar_integration: 'calendly',
      min_lead_score: 75,
      working_hours: '9-17',
      timezone: 'UTC'
    }
  },
  {
    type: 'follow_up',
    name: 'Follow-up Automation',
    description: 'Send automated follow-up sequences',
    icon: Clock,
    defaultParameters: {
      sequence_delay_days: 3,
      max_attempts: 5,
      personalization_enabled: true
    }
  },
  {
    type: 'data_enrichment',
    name: 'Data Enrichment',
    description: 'Enrich account data with additional information',
    icon: SettingsIcon,
    defaultParameters: {
      data_sources: ['clearbit', 'zoominfo'],
      auto_update: true,
      batch_size: 100
    }
  }
];

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'default-qualification',
    name: 'Lead Qualification Agent',
    type: 'lead_qualification',
    description: 'Automatically qualifies incoming leads based on ICP criteria',
    parameters: { min_score_threshold: 70, auto_assign: true },
    enabled: true,
    schedule: { frequency: 'continuous' },
    status: 'active',
    isDefault: true,
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  },
  {
    id: 'default-enrichment',
    name: 'Data Enrichment Agent',
    type: 'data_enrichment',
    description: 'Enriches contact and account data from external sources',
    parameters: { data_sources: ['clearbit'], batch_size: 50 },
    enabled: false,
    schedule: { frequency: 'daily', time: '02:00' },
    status: 'inactive',
    isDefault: true
  }
];

export default function AIAgentSettings() {
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: '' as Agent['type'] | '',
    description: '',
    parameters: '{}',
    schedule: {
      frequency: 'daily' as Agent['schedule']['frequency'],
      time: '09:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    }
  });
  const { toast } = useToast();

  const toggleAgent = (id: string, enabled: boolean) => {
    setAgents(prev => prev.map(agent =>
      agent.id === id
        ? {
            ...agent,
            enabled,
            status: enabled ? 'active' : 'inactive',
            nextRun: enabled ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : undefined
          }
        : agent
    ));
    
    const agent = agents.find(a => a.id === id);
    toast({
      title: enabled ? "Agent Enabled" : "Agent Disabled",
      description: `${agent?.name} has been ${enabled ? 'enabled' : 'disabled'}`
    });
  };

  const createAgent = () => {
    try {
      const parameters = JSON.parse(formData.parameters);
      const newAgent: Agent = {
        id: `agent-${Date.now()}`,
        name: formData.name,
        type: formData.type as Agent['type'],
        description: formData.description,
        parameters,
        enabled: true,
        schedule: formData.schedule,
        status: 'active',
        isDefault: false,
        nextRun: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      };

      setAgents(prev => [...prev, newAgent]);
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "AI Agent created successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid JSON in parameters field",
        variant: "destructive"
      });
    }
  };

  const updateAgent = () => {
    if (!selectedAgent) return;

    try {
      const parameters = JSON.parse(formData.parameters);
      setAgents(prev => prev.map(agent =>
        agent.id === selectedAgent.id
          ? {
              ...agent,
              name: formData.name,
              description: formData.description,
              parameters,
              schedule: formData.schedule
            }
          : agent
      ));

      setIsEditDialogOpen(false);
      setSelectedAgent(null);
      resetForm();
      toast({ title: "Success", description: "AI Agent updated successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid JSON in parameters field",
        variant: "destructive"
      });
    }
  };

  const deleteAgent = (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (agent?.isDefault) {
      toast({
        title: "Cannot Delete",
        description: "Default agents cannot be deleted",
        variant: "destructive"
      });
      return;
    }

    setAgents(prev => prev.filter(a => a.id !== id));
    toast({ title: "Success", description: "AI Agent deleted successfully" });
  };

  const editAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setFormData({
      name: agent.name,
      type: agent.type,
      description: agent.description,
      parameters: JSON.stringify(agent.parameters, null, 2),
      schedule: {
        frequency: agent.schedule.frequency,
        time: agent.schedule.time || '09:00',
        days: agent.schedule.days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      }
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: '',
      description: '',
      parameters: '{}',
      schedule: {
        frequency: 'daily',
        time: '09:00',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      }
    });
  };

  const runAgent = (agent: Agent) => {
    setAgents(prev => prev.map(a =>
      a.id === agent.id
        ? {
            ...a,
            lastRun: new Date().toISOString(),
            nextRun: new Date(Date.now() + 60 * 60 * 1000).toISOString()
          }
        : a
    ));
    toast({ title: "Agent Started", description: `${agent.name} is now running` });
  };

  const getStatusBadge = (status: Agent['status']) => {
    const configs = {
      active: { variant: 'default' as const, label: 'Active', icon: CheckCircle },
      inactive: { variant: 'secondary' as const, label: 'Inactive', icon: Pause },
      error: { variant: 'destructive' as const, label: 'Error', icon: AlertCircle }
    };
    const config = configs[status];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getTemplate = (type: Agent['type']) => {
    return AGENT_TEMPLATES.find(t => t.type === type);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">AI Agent Management</h3>
          <p className="text-sm text-muted-foreground">Configure and manage your automated AI agents</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create AI Agent</DialogTitle>
              <DialogDescription>Configure a new AI agent to automate your workflows</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Agent Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Custom Agent"
                  />
                </div>
                <div>
                  <Label>Agent Type</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value: Agent['type']) => {
                      const template = AGENT_TEMPLATES.find(t => t.type === value);
                      setFormData(prev => ({
                        ...prev,
                        type: value,
                        parameters: JSON.stringify(template?.defaultParameters || {}, null, 2)
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENT_TEMPLATES.map(template => (
                        <SelectItem key={template.type} value={template.type}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this agent does"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Run Frequency</Label>
                  <Select 
                    value={formData.schedule.frequency} 
                    onValueChange={(value: Agent['schedule']['frequency']) => 
                      setFormData(prev => ({ ...prev, schedule: { ...prev.schedule, frequency: value } }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continuous">Continuous</SelectItem>
                      <SelectItem value="hourly">Every Hour</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.schedule.frequency !== 'continuous' && (
                  <div>
                    <Label>Run Time</Label>
                    <Input
                      type="time"
                      value={formData.schedule.time}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, time: e.target.value }
                      }))}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label>Parameters (JSON)</Label>
                <Textarea
                  value={formData.parameters}
                  onChange={(e) => setFormData(prev => ({ ...prev, parameters: e.target.value }))}
                  className="font-mono text-sm"
                  rows={6}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createAgent}>Create Agent</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Default Agents */}
      <Card>
        <CardHeader>
          <CardTitle>Default Agents</CardTitle>
          <CardDescription>Built-in agents that can be enabled or disabled</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agents.filter(agent => agent.isDefault).map(agent => {
              const template = getTemplate(agent.type);
              const Icon = template?.icon || Bot;
              
              return (
                <div key={agent.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{agent.name}</h4>
                        {getStatusBadge(agent.status)}
                        <Badge variant="outline">Default</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{agent.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {agent.lastRun && (
                          <span>Last run: {new Date(agent.lastRun).toLocaleString()}</span>
                        )}
                        {agent.nextRun && agent.enabled && (
                          <span>Next run: {new Date(agent.nextRun).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={agent.enabled}
                      onCheckedChange={(enabled) => toggleAgent(agent.id, enabled)}
                    />
                    <Button variant="outline" size="sm" onClick={() => editAgent(agent)}>
                      <SettingsIcon className="h-4 w-4" />
                    </Button>
                    {agent.enabled && (
                      <Button variant="outline" size="sm" onClick={() => runAgent(agent)}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Agents */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Agents</CardTitle>
          <CardDescription>Your custom-configured AI agents</CardDescription>
        </CardHeader>
        <CardContent>
          {agents.filter(agent => !agent.isDefault).length > 0 ? (
            <div className="space-y-4">
              {agents.filter(agent => !agent.isDefault).map(agent => {
                const template = getTemplate(agent.type);
                const Icon = template?.icon || Bot;
                
                return (
                  <div key={agent.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{agent.name}</h4>
                          {getStatusBadge(agent.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{agent.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Runs: {agent.schedule.frequency}</span>
                          {agent.lastRun && (
                            <span>Last run: {new Date(agent.lastRun).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={agent.enabled}
                        onCheckedChange={(enabled) => toggleAgent(agent.id, enabled)}
                      />
                      <Button variant="outline" size="sm" onClick={() => editAgent(agent)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {agent.enabled && (
                        <Button variant="outline" size="sm" onClick={() => runAgent(agent)}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => deleteAgent(agent.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium mb-2">No Custom Agents</h4>
              <p className="text-sm text-muted-foreground mb-4">Create custom AI agents for specific workflows</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Agent
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit AI Agent</DialogTitle>
            <DialogDescription>Update agent configuration</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Agent Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div>
              <Label>Parameters (JSON)</Label>
              <Textarea
                value={formData.parameters}
                onChange={(e) => setFormData(prev => ({ ...prev, parameters: e.target.value }))}
                className="font-mono text-sm"
                rows={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateAgent}>Update Agent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}