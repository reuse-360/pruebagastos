-- Renombrar Paulina → Pau
update household_members
set name = 'Pau'
where name = 'Paulina';

-- Agregar categoría personal "Pau"
insert into expense_categories (name, is_shared, active)
values ('Pau', false, true);
