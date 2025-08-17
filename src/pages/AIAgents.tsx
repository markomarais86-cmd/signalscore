import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Bot, Play, Edit, Trash2, Clock, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface Agent {
  id: string;
  name: string;
  type: 'lead_qualification' | 'meeting_scheduling' | 'follow_up' | 'data_enrichment';
  description: string;
  parameters: any;
  created_at: string;
  last_run?: string;
  status: 'active' | 'inactive';
}

interface AgentExecution {
  id: string;
  agent_id: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  results?: any;
}

const AGENT_TYPES = [
  { value: 'lead_qualification', label: 'Lead Qualification', description: 'Automatically score and qualify leads based on criteria' },
  { value: 'meeting_scheduling', label: 'Meeting Scheduling', description: 'Schedule meetings with qualified prospects' },
  { value: 'follow_up', label: 'Follow-up', description: 'Send automated follow-up sequences' },
  { value: 'data_enrichment', label: 'Data Enrichment', description: 'Enrich account data with additional information' }
];

export default function AIAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "" as Agent['type'] | "",
    description: "",
    parameters: "{}"
  });
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadMockData();
  }, []);

  const loadMockData = () => {
    // Mock data for demonstration
    const mockAgents: Agent[] = [
      {
        id: '1',
        name: 'Enterprise Lead Qualifier',
        type: 'lead_qualification',
        description: 'Automatically qualifies enterprise leads based on company size, industry, and engagement signals',
        parameters: { min_employee_count: 500, target_industries: ['Technology', 'Financial Services'] },
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        last_run: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      },
      {
        id: '2',
        name: 'Demo Scheduler',
        type: 'meeting_scheduling',
        description: 'Schedules product demos with qualified leads automatically',
        parameters: { calendar_link: 'https://calendly.com/demo', min_score: 70 },
        created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      },
      {
        id: '3',
        name: 'Contact Enricher',
        type: 'data_enrichment',
        description: 'Enriches contact profiles with LinkedIn and other social data',
        parameters: { data_sources: ['linkedin', 'clearbit'] },
        created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'inactive'
      }
    ];

    const mockExecutions: AgentExecution[] = [
      {
        id: '1',
        agent_id: '1',
        status: 'completed',
        started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
        results: { qualified: 23, total_processed: 156 }
      },
      {
        id: '2',
        agent_id: '2',
        status: 'completed',
        started_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(Date.now() - 6 * 60 * 60 * 1000 + 3 * 60 * 1000).toISOString(),
        results: { meetings_scheduled: 5, invitations_sent: 12 }
      }
    ];

    setAgents(mockAgents);
    setExecutions(mockExecutions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let parameters;
      try {
        parameters = JSON.parse(formData.parameters);
      } catch {
        throw new Error("Invalid JSON in parameters field");
      }

      const newAgent: Agent = {
        id: editingAgent?.id || Date.now().toString(),
        name: formData.name,
        type: formData.type as Agent['type'],
        description: formData.description,
        parameters,
        created_at: editingAgent?.created_at || new Date().toISOString(),
        status: 'active'
      };

      if (editingAgent) {
        setAgents(prev => prev.map(a => a.id === editingAgent.id ? newAgent : a));
        toast({ title: "Success", description: "Agent updated successfully" });
      } else {
        setAgents(prev => [...prev, newAgent]);
        toast({ title: "Success", description: "Agent created successfully" });
      }

      setIsDialogOpen(false);
      setEditingAgent(null);
      setFormData({ name: "", type: "", description: "", parameters: "{}" });
    } catch (error) {
      console.error('Error saving agent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save agent",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      type: agent.type,
      description: agent.description,
      parameters: JSON.stringify(agent.parameters, null, 2)
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;
    
    setAgents(prev => prev.filter(a => a.id !== id));
    toast({ title: "Success", description: "Agent deleted successfully" });
  };

  const handleRun = (agent: Agent) => {
    const executionId = Date.now().toString();
    const newExecution: AgentExecution = {
      id: executionId,
      agent_id: agent.id,
      status: 'running',
      started_at: new Date().toISOString()
    };

    setExecutions(prev => [...prev, newExecution]);
    toast({ title: "Agent Started", description: `${agent.name} is now running` });

    // Simulate completion after 3 seconds
    setTimeout(() => {
      setExecutions(prev => prev.map(e => 
        e.id === executionId 
          ? { 
              ...e, 
              status: 'completed', 
              completed_at: new Date().toISOString(),
              results: { message: 'Execution completed successfully' }
            }
          : e
      ));
      
      setAgents(prev => prev.map(a => 
        a.id === agent.id 
          ? { ...a, last_run: new Date().toISOString() }
          : a
      ));
      
      toast({ title: "Agent Completed", description: `${agent.name} finished running` });
    }, 3000);
  };

  const getTypeInfo = (type: Agent['type']) => {
    return AGENT_TYPES.find(t => t.value === type);
  };

  const getStatusBadge = (status: Agent['status']) => {
    return status === 'active' 
      ? <Badge className="bg-green-500">Active</Badge>
      : <Badge variant="secondary">Inactive</Badge>;
  };

  const getExecutionStatus = (agentId: string) => {
    const recentExecution = executions
      .filter(e => e.agent_id === agentId)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];
    
    if (!recentExecution) return null;
    
    if (recentExecution.status === 'running') {
      return <Badge variant="outline" className="animate-pulse">Running...</Badge>;
    }
    
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">AI Agents</h1>
          <p className="text-muted-foreground">Automate your go-to-market workflows with intelligent agents</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingAgent ? "Edit" : "Create"} AI Agent</DialogTitle>
              <DialogDescription>
                Configure an AI agent to automate specific tasks in your GTM workflow
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Enterprise Lead Qualifier"
                  required
                />
              </div>

              <div>
                <Label htmlFor="type">Agent Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as Agent['type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent type" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this agent does and when it should run"
                  required
                />
              </div>

              <div>
                <Label htmlFor="parameters">Parameters (JSON)</Label>
                <Textarea
                  id="parameters"
                  value={formData.parameters}
                  onChange={(e) => setFormData(prev => ({ ...prev, parameters: e.target.value }))}
                  placeholder='{"key": "value"}'
                  className="font-mono text-sm"
                  rows={4}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingAgent ? "Update" : "Create"} Agent
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agent Templates Info */}
      <Card>
        <CardHeader>
          <CardTitle>Available Agent Types</CardTitle>
          <CardDescription>Choose from these pre-configured agent templates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {AGENT_TYPES.map(type => (
              <div key={type.value} className="p-4 border rounded-lg">
                <h4 className="font-medium">{type.label}</h4>
                <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Agents */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const typeInfo = getTypeInfo(agent.type);
          const executionStatus = getExecutionStatus(agent.id);
          
          return (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(agent)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(agent.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(agent.status)}
                  {executionStatus}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Badge variant="outline">{typeInfo?.label}</Badge>
                </div>
                
                <p className="text-sm text-muted-foreground">{agent.description}</p>

                {agent.last_run && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Last run: {new Date(agent.last_run).toLocaleDateString()}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleRun(agent)}
                    disabled={!!executionStatus}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run Agent
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {agents.length === 0 && (
          <div className="col-span-full">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="text-lg mb-2">No AI Agents Yet</CardTitle>
                <CardDescription className="text-center mb-4">
                  Create your first AI agent to automate repetitive GTM tasks
                </CardDescription>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Agent
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Recent Executions */}
      {executions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
            <CardDescription>Latest agent runs and their results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {executions
                .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                .slice(0, 5)
                .map((execution) => {
                  const agent = agents.find(a => a.id === execution.agent_id);
                  return (
                    <div key={execution.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          execution.status === 'completed' ? 'bg-green-500' : 
                          execution.status === 'running' ? 'bg-blue-500 animate-pulse' : 
                          'bg-red-500'
                        }`} />
                        <div>
                          <p className="font-medium">{agent?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(execution.started_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          execution.status === 'completed' ? 'default' :
                          execution.status === 'running' ? 'secondary' : 'destructive'
                        }>
                          {execution.status}
                        </Badge>
                        {execution.results && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {JSON.stringify(execution.results)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}