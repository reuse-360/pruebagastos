import { supabase } from "./supabase";

// Fila unificada para la vista de resumen (Gon o Pau)
export interface TxRow {
  fecha: string;
  quien_pago: string;
  categoria: string;
  descripcion: string | null;
  valor_original: number;
  valor_persona: number; // valor_gon o valor_pau según la tabla
}

// Categoría agregada para el dashboard
export interface CategoryTotal {
  name: string;
  total: number;
  type: "ambos" | "gon" | "pau";
}

function dateRange(year: number, month: number) {
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayDate = new Date(year, month, 0);
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;
  return { firstDay, lastDay };
}

export async function fetchGastosGon(year: number, month: number): Promise<{ rows: TxRow[]; error: unknown }> {
  const { firstDay, lastDay } = dateRange(year, month);
  const { data, error } = await supabase
    .from("gastos_gon")
    .select("fecha, quien_pago, categoria, descripcion, valor_original, valor_gon")
    .gte("fecha", firstDay)
    .lte("fecha", lastDay)
    .order("fecha", { ascending: true });

  if (error || !data) return { rows: [], error };

  const rows: TxRow[] = (data as Array<{
    fecha: string; quien_pago: string; categoria: string;
    descripcion: string | null; valor_original: number; valor_gon: number;
  }>).map((r) => ({
    fecha: r.fecha,
    quien_pago: r.quien_pago,
    categoria: r.categoria,
    descripcion: r.descripcion,
    valor_original: r.valor_original,
    valor_persona: r.valor_gon,
  }));

  return { rows, error: null };
}

export async function fetchGastosPau(year: number, month: number): Promise<{ rows: TxRow[]; error: unknown }> {
  const { firstDay, lastDay } = dateRange(year, month);
  const { data, error } = await supabase
    .from("gastos_pau")
    .select("fecha, quien_pago, categoria, descripcion, valor_original, valor_pau")
    .gte("fecha", firstDay)
    .lte("fecha", lastDay)
    .order("fecha", { ascending: true });

  if (error || !data) return { rows: [], error };

  const rows: TxRow[] = (data as Array<{
    fecha: string; quien_pago: string; categoria: string;
    descripcion: string | null; valor_original: number; valor_pau: number;
  }>).map((r) => ({
    fecha: r.fecha,
    quien_pago: r.quien_pago,
    categoria: r.categoria,
    descripcion: r.descripcion,
    valor_original: r.valor_original,
    valor_persona: r.valor_pau,
  }));

  return { rows, error: null };
}

export async function fetchDashboardData(year: number, month: number) {
  const { firstDay, lastDay } = dateRange(year, month);

  const [gonResult, pauResult] = await Promise.all([
    supabase
      .from("gastos_gon")
      .select("categoria, valor_original, valor_gon, quien_pago")
      .gte("fecha", firstDay)
      .lte("fecha", lastDay),
    supabase
      .from("gastos_pau")
      .select("categoria, valor_original, valor_pau, quien_pago")
      .gte("fecha", firstDay)
      .lte("fecha", lastDay),
  ]);

  const gonRows = (gonResult.data ?? []) as Array<{ categoria: string; valor_gon: number; quien_pago: string }>;
  const pauRows = (pauResult.data ?? []) as Array<{ categoria: string; valor_pau: number; quien_pago: string }>;

  const totalGon = gonRows.reduce((s, r) => s + r.valor_gon, 0);
  const totalPau = pauRows.reduce((s, r) => s + r.valor_pau, 0);
  const totalMes = totalGon + totalPau;

  // Agregar por categoría (valor_gon + valor_pau = total sin doble conteo)
  const map = new Map<string, { totalGon: number; totalPau: number }>();
  for (const r of gonRows) {
    const e = map.get(r.categoria) ?? { totalGon: 0, totalPau: 0 };
    e.totalGon += r.valor_gon;
    map.set(r.categoria, e);
  }
  for (const r of pauRows) {
    const e = map.get(r.categoria) ?? { totalGon: 0, totalPau: 0 };
    e.totalPau += r.valor_pau;
    map.set(r.categoria, e);
  }

  const categories: CategoryTotal[] = Array.from(map.entries())
    .map(([name, { totalGon: tg, totalPau: tp }]) => ({
      name,
      total: tg + tp,
      type: (tg > 0 && tp > 0 ? "ambos" : tg > 0 ? "gon" : "pau") as CategoryTotal["type"],
    }))
    .sort((a, b) => b.total - a.total);

  return { totalMes, totalGon, totalPau, categories, error: gonResult.error ?? pauResult.error };
}
