-- Enable realtime for bulk_scoring_jobs table
ALTER TABLE bulk_scoring_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE bulk_scoring_jobs;