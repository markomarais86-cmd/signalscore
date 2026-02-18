
-- Create a function to batch-update accounts org_id
CREATE OR REPLACE FUNCTION batch_move_accounts_org()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  moved integer := 0;
BEGIN
  UPDATE accounts SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634'
  WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f'
  AND id IN (
    SELECT id FROM accounts
    WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f'
    LIMIT 10000
  );
  GET DIAGNOSTICS moved = ROW_COUNT;
  RETURN moved;
END;
$$;
