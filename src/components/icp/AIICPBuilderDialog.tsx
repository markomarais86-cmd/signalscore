import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Upload } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface AIICPBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  onSuccess: (icpId: string) => void;
}

export function AIICPBuilderDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
  onSuccess,
}: AIICPBuilderDialogProps) {
  const [companyName, setCompanyName] = useState(orgName);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      setIsParsingFile(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item: any) => item.str).join(" ");
          fullText += pageText + "\n\n";
        }
        setDocumentText((prev) => (prev ? prev + "\n\n" + fullText : fullText));
        toast.success(`Extracted text from ${pdf.numPages} pages of ${file.name}`);
      } catch (err) {
        console.error("PDF parsing error:", err);
        toast.error("Failed to parse PDF. Try pasting the text content directly.");
      } finally {
        setIsParsingFile(false);
      }
    } else if (file.type === "text/plain" || file.name.endsWith(".csv")) {
      const text = await file.text();
      setDocumentText((prev) => (prev ? prev + "\n\n" + text : text));
      toast.success(`Loaded ${file.name}`);
    } else {
      toast.info("Unsupported format. Please upload a PDF or text file, or paste content directly.");
    }
  };

  const handleGenerate = async () => {
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!documentText.trim()) {
      toast.error("Please paste or upload document content");
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-icp-document", {
        body: {
          company_name: companyName.trim(),
          website_url: websiteUrl.trim() || undefined,
          document_text: documentText.trim(),
          org_id: orgId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        `Created ICP profile with ${data.extracted_fields} fields extracted`
      );
      onOpenChange(false);
      onSuccess(data.icp_id);
    } catch (err: any) {
      console.error("AI ICP Builder error:", err);
      toast.error(err.message || "Failed to process document");
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset state when dialog opens with new org name
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setCompanyName(orgName);
      setDocumentText("");
      setWebsiteUrl("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI ICP Builder
          </DialogTitle>
          <DialogDescription>
            Paste or upload your ICP document and AI will extract all fields to create
            a complete ICP profile automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="builder-company-name">Company Name *</Label>
              <Input
                id="builder-company-name"
                placeholder="e.g. 91Life"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="builder-website-url">Website URL</Label>
              <Input
                id="builder-website-url"
                placeholder="e.g. https://91.life"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="builder-doc-upload">Upload Document (PDF, TXT, CSV)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="builder-doc-upload"
                type="file"
                accept=".txt,.csv,.pdf"
                onChange={handleFileUpload}
                disabled={isProcessing || isParsingFile}
                className="flex-1"
              />
              {isParsingFile ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Upload className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="builder-document-text">
              ICP Document Content *
              <span className="text-muted-foreground font-normal ml-2">
                Paste from PDF, PowerPoint, or any ICP document
              </span>
            </Label>
            <Textarea
              id="builder-document-text"
              placeholder="Paste your ICP document content here... Include industries, company sizes, geographies, personas, buying triggers, etc."
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              disabled={isProcessing}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {documentText.length > 0
                ? `${documentText.length.toLocaleString()} characters`
                : "Tip: Open your PDF, Select All (Ctrl+A), Copy (Ctrl+C), then paste here"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isProcessing || !companyName || !documentText}>
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing with AI...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate ICP
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
