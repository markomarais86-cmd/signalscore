
CREATE TABLE public.value_creation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  plan_name text NOT NULL DEFAULT '100-Day GTM Value Creation',
  started_at timestamptz NOT NULL DEFAULT now(),
  target_completion_at timestamptz NOT NULL DEFAULT (now() + interval '100 days'),
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.value_creation_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.value_creation_plans(id) ON DELETE CASCADE NOT NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  milestone_key text NOT NULL,
  title text NOT NULL,
  description text,
  target_day integer NOT NULL,
  phase text NOT NULL,
  auto_detect boolean NOT NULL DEFAULT true,
  completed_at timestamptz,
  completed_by uuid,
  manual_notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, milestone_key)
);

ALTER TABLE public.value_creation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_creation_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read value_creation_plans"
  ON public.value_creation_plans FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert value_creation_plans"
  ON public.value_creation_plans FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update value_creation_plans"
  ON public.value_creation_plans FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read value_creation_milestones"
  ON public.value_creation_milestones FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert value_creation_milestones"
  ON public.value_creation_milestones FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update value_creation_milestones"
  ON public.value_creation_milestones FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
