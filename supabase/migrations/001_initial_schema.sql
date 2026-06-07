-- household_members
create table if not exists household_members (
  id         serial primary key,
  name       text    not null,
  monthly_income numeric(12, 2) not null default 0,
  active     boolean not null default true
);

-- expense_categories
create table if not exists expense_categories (
  id        serial primary key,
  name      text    not null,
  is_shared boolean not null default false,
  active    boolean not null default true
);

-- transactions
create table if not exists transactions (
  id                   serial primary key,
  amount               numeric(12, 2) not null,
  transaction_date     date           not null default current_date,
  description          text,
  category_id          integer references expense_categories (id) on delete set null,
  paid_by_member_id    integer references household_members (id) on delete set null,
  created_at           timestamptz    not null default now()
);
