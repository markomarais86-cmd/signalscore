import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Key, Copy, Trash2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  scopes: string[];
}

export function APIKeyManager() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>("never");
  const [generatedKey, setGeneratedKey] = useState<string>("");
  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    loadAPIKeys();
  }, [userProfile]);

  const loadAPIKeys = async () => {
    if (!userProfile) return;

    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("org_id", userProfile.org_id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load API keys",
        variant: "destructive",
      });
      return;
    }

    setApiKeys(data || []);
  };

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the API key",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const expiresInDays = newKeyExpiry === "never" ? null : parseInt(newKeyExpiry);

      const { data, error } = await supabase.functions.invoke("generate-api-key", {
        body: {
          name: newKeyName,
          scopes: ["read", "write"],
          expires_in_days: expiresInDays,
        },
      });

      if (error) throw error;

      setGeneratedKey(data.api_key);
      setNewKeyName("");
      setNewKeyExpiry("never");
      
      toast({
        title: "API Key Generated",
        description: "Copy your API key now - it won't be shown again",
      });

      await loadAPIKeys();
    } catch (error: any) {
      console.error("Error generating API key:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate API key",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const handleDeleteKey = async (keyId: string) => {
    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", keyId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "API key deleted",
    });

    await loadAPIKeys();
  };

  const handleToggleActive = async (keyId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("api_keys")
      .update({ is_active: !currentStatus })
      .eq("id", keyId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update API key status",
        variant: "destructive",
      });
      return;
    }

    await loadAPIKeys();
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setGeneratedKey("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Keys
        </CardTitle>
        <CardDescription>
          Manage API keys for programmatic access to your data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setIsDialogOpen(true)}>
            Generate New Key
          </Button>
        </div>

        <div className="space-y-2">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{key.name}</p>
                  {!key.is_active && (
                    <span className="text-xs px-2 py-1 bg-muted rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground font-mono">
                  {key.key_prefix}...
                </p>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>
                    Created: {new Date(key.created_at).toLocaleDateString()}
                  </span>
                  {key.last_used_at && (
                    <span>
                      Last used: {new Date(key.last_used_at).toLocaleDateString()}
                    </span>
                  )}
                  {key.expires_at && (
                    <span>
                      Expires: {new Date(key.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(key.id, key.is_active)}
                >
                  {key.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteKey(key.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {apiKeys.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No API keys yet. Generate one to get started.
            </p>
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {generatedKey ? "Your API Key" : "Generate New API Key"}
              </DialogTitle>
              <DialogDescription>
                {generatedKey
                  ? "Copy this key now - it won't be shown again"
                  : "Create a new API key for programmatic access"}
              </DialogDescription>
            </DialogHeader>

            {generatedKey ? (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Store this key securely. You won't be able to see it again.
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Input value={generatedKey} readOnly className="font-mono" />
                  <Button onClick={() => handleCopyKey(generatedKey)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Production API"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry</Label>
                  <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                    <SelectTrigger id="expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter>
              {generatedKey ? (
                <Button onClick={closeDialog}>Done</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleGenerateKey} disabled={isLoading}>
                    {isLoading ? "Generating..." : "Generate Key"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
