import { DuplicateAccountMerger } from "@/components/settings/DuplicateAccountMerger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MergeDuplicates() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Merge Duplicate Accounts
          </h1>
          <p className="text-muted-foreground mt-2">
            Clean up duplicate accounts before matching leads
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Why Merge Duplicates?</CardTitle>
          <CardDescription>
            You currently have ~8,700 duplicate accounts in your database (e.g., "td.com", "www.td.com", "https://td.com").
            Merging these will:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Reduce 14,068 accounts → ~4,700 unique accounts</li>
            <li>Improve lead-to-account matching accuracy</li>
            <li>Consolidate all scores, leads, and contacts to the master account</li>
            <li>Prevent future duplicates with a unique constraint</li>
          </ul>
        </CardContent>
      </Card>

      <DuplicateAccountMerger />
    </div>
  );
}
