-- Enable real-time for ICP insights auto-refresh

-- Ensure Leads table has REPLICA IDENTITY FULL for complete row data
ALTER TABLE "Leads" REPLICA IDENTITY FULL;

-- Ensure scores table has REPLICA IDENTITY FULL for complete row data
ALTER TABLE scores REPLICA IDENTITY FULL;

-- Add Leads to realtime publication (if not already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Leads";
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Table already in publication
  END;
END $$;

-- Add scores to realtime publication (if not already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Table already in publication
  END;
END $$;