-- Categorías compartidas
insert into expense_categories (name, is_shared) values
  ('Dividendo',  true),
  ('Papudo',     true),
  ('Casa',       true),
  ('Internet',   true),
  ('Celular',    true),
  ('Agua',       true),
  ('Luz',        true),
  ('Gas',        true),
  ('Nana',       true),
  ('Super',      true),
  ('Domi',       true),
  ('Comida',     true),
  ('Auto',       true);

-- Categorías personales
insert into expense_categories (name, is_shared) values
  ('Banco',          false),
  ('Doc',            false),
  ('Karrete',        false),
  ('Uber',           false),
  ('Pega-almuerzos', false),
  ('Invitación',     false),
  ('Inglés',         false),
  ('Futbol',         false),
  ('Imprevistos',    false),
  ('YO',             false);
