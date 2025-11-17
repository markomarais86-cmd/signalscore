import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, Sparkles, DollarSign } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ApolloRedemptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableContacts: number;
  availableAccounts: number;
}

export function ApolloRedemptionDialog({
  open,
  onOpenChange,
  availableContacts,
  availableAccounts
}: ApolloRedemptionDialogProps) {
  const [importLimit, setImportLimit] = useState("1000");
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([
    "Technical Decision Maker",
    "Business Decision Maker"
  ]);

  const personas = [
    "Technical Decision Maker",
    "Business Decision Maker",
    "IT Decision Maker",
    "Technical Influencer",
    "Business Influencer"
  ];

  const estimatedCost = Math.ceil(parseInt(importLimit || "0") * 0.01);

  const handlePersonaToggle = (persona: string) => {
    setSelectedPersonas(prev =>
      prev.includes(persona)
        ? prev.filter(p => p !== persona)
        : [...prev, persona]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Redeem Apollo Contacts
          </DialogTitle>
          <DialogDescription>
            Import high-quality contacts from Apollo into your database. You have{" "}
            <strong>{availableContacts.toLocaleString()} contacts</strong> across{" "}
            <strong>{availableAccounts.toLocaleString()} accounts</strong> available.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Import Limit */}
          <div className="space-y-2">
            <Label htmlFor="import-limit">Import Limit</Label>
            <Input
              id="import-limit"
              type="number"
              value={importLimit}
              onChange={(e) => setImportLimit(e.target.value)}
              placeholder="1000"
              min="1"
              max={availableContacts}
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of contacts to import (max: {availableContacts.toLocaleString()})
            </p>
          </div>

          {/* Persona Filter */}
          <div className="space-y-3">
            <Label>Target Personas</Label>
            <div className="grid grid-cols-2 gap-3">
              {personas.map((persona) => (
                <div key={persona} className="flex items-center space-x-2">
                  <Checkbox
                    id={persona}
                    checked={selectedPersonas.includes(persona)}
                    onCheckedChange={() => handlePersonaToggle(persona)}
                  />
                  <Label
                    htmlFor={persona}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {persona}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Cost Estimate */}
          <Alert>
            <DollarSign className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>Estimated cost for {parseInt(importLimit || "0").toLocaleString()} contacts:</span>
                <Badge variant="secondary" className="text-lg font-bold">
                  ${estimatedCost}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Apollo charges approximately $0.01 per contact enrichment
              </p>
            </AlertDescription>
          </Alert>

          {/* Warning */}
          <Alert variant="default" className="bg-muted/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Imported contacts will be added to your database with <strong>data_source='database'</strong> and 
              automatically scored based on your ICP. This action cannot be undone.
            </AlertDescription>
          </Alert>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!importLimit || parseInt(importLimit) === 0 || selectedPersonas.length === 0}
            onClick={() => {
              // TODO: Call edge function to redeem contacts
              console.log("Redeeming contacts:", { importLimit, selectedPersonas });
              onOpenChange(false);
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Import {parseInt(importLimit || "0").toLocaleString()} Contacts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
