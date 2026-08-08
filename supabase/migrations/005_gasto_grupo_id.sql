-- Vincula las dos filas de un gasto "ambos" (una en gastos_gon, una en
-- gastos_pau) para poder editarlas/borrarlas juntas de forma consistente.
ALTER TABLE gastos_gon ADD COLUMN grupo_id UUID;
ALTER TABLE gastos_pau ADD COLUMN grupo_id UUID;

CREATE INDEX idx_gastos_gon_grupo_id ON gastos_gon(grupo_id) WHERE grupo_id IS NOT NULL;
CREATE INDEX idx_gastos_pau_grupo_id ON gastos_pau(grupo_id) WHERE grupo_id IS NOT NULL;
