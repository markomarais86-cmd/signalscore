
-- Clean up Test Onboarding Corp (2cdf2add-9d96-4b13-991d-ebbb400becde)
-- Child records first, then parent org

DELETE FROM public.ai_agent_registry WHERE org_id = '2cdf2add-9d96-4b13-991d-ebbb400becde';
DELETE FROM public.alerts WHERE org_id = '2cdf2add-9d96-4b13-991d-ebbb400becde';
DELETE FROM public.external_data_sources WHERE org_id = '2cdf2add-9d96-4b13-991d-ebbb400becde';
DELETE FROM public.icp_profiles WHERE org_id = '2cdf2add-9d96-4b13-991d-ebbb400becde';
DELETE FROM public.audit_logs WHERE org_id = '2cdf2add-9d96-4b13-991d-ebbb400becde';
DELETE FROM public.organizations WHERE id = '2cdf2add-9d96-4b13-991d-ebbb400becde';
