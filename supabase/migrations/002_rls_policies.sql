-- Enable RLS on all tables
alter table household_members    enable row level security;
alter table expense_categories   enable row level security;
alter table transactions         enable row level security;

-- Allow anon read on reference tables
create policy "anon can read household_members"
  on household_members for select to anon using (true);

create policy "anon can read expense_categories"
  on expense_categories for select to anon using (true);

-- Allow anon full access on transactions
create policy "anon can read transactions"
  on transactions for select to anon using (true);

create policy "anon can insert transactions"
  on transactions for insert to anon with check (true);

create policy "anon can update transactions"
  on transactions for update to anon using (true);

create policy "anon can delete transactions"
  on transactions for delete to anon using (true);
