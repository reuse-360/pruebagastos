-- Explicit Data API grants (Supabase stops auto-granting on new public tables from 2026-10-30).
-- Idempotent: safe to re-run. Access is still gated by RLS policies.
grant select, insert, update, delete on public.expense_categories to anon, authenticated, service_role;
grant select, insert, update, delete on public.gastos_gon to anon, authenticated, service_role;
grant select, insert, update, delete on public.gastos_pau to anon, authenticated, service_role;
grant select, insert, update, delete on public.household_members to anon, authenticated, service_role;
grant select, insert, update, delete on public.optimos_mensuales to anon, authenticated, service_role;
grant select, insert, update, delete on public.sugerencias to anon, authenticated, service_role;
grant select, insert, update, delete on public.transactions to anon, authenticated, service_role;
