-- Create export_jobs table for background export processing
CREATE TABLE IF NOT EXISTS public.export_jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    export_type TEXT NOT NULL CHECK (export_type IN ('accounts', 'leads', 'campaigns', 'contacts')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_records INTEGER NOT NULL DEFAULT 0,
    processed_records INTEGER NOT NULL DEFAULT 0,
    filename TEXT,
    download_url TEXT,
    filters JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Enable RLS
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their org's export jobs"
ON public.export_jobs
FOR SELECT
USING (
    org_id IN (
        SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can create export jobs for their org"
ON public.export_jobs
FOR INSERT
WITH CHECK (
    org_id IN (
        SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their org's export jobs"
ON public.export_jobs
FOR UPDATE
USING (
    org_id IN (
        SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_export_jobs_org_id ON public.export_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON public.export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at ON public.export_jobs(created_at DESC);

-- Enable realtime for export job updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.export_jobs;