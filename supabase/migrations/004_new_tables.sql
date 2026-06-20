-- Tabla de gastos de Gon
CREATE TABLE gastos_gon (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  quien_pago TEXT NOT NULL CHECK (quien_pago IN ('gon', 'pau', 'ambos')),
  categoria TEXT NOT NULL,
  descripcion TEXT,
  valor_original NUMERIC(12,2) NOT NULL,
  valor_gon NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de gastos de Pau
CREATE TABLE gastos_pau (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  quien_pago TEXT NOT NULL CHECK (quien_pago IN ('gon', 'pau', 'ambos')),
  categoria TEXT NOT NULL,
  descripcion TEXT,
  valor_original NUMERIC(12,2) NOT NULL,
  valor_pau NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE gastos_gon ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_pau ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_gastos_gon" ON gastos_gon FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_gastos_pau" ON gastos_pau FOR ALL TO anon USING (true) WITH CHECK (true);
