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

export async function fetchDashboardData(year: number, month: number, person: "gon" | "pau") {
  const { firstDay, lastDay } = dateRange(year, month);
  const isGon = person === "gon";
  const table = isGon ? "gastos_gon" : "gastos_pau";
  const valorField = isGon ? "valor_gon" : "valor_pau";

  const { data, error } = await supabase
    .from(table)
    .select(`categoria, valor_original, ${valorField}, quien_pago`)
    .gte("fecha", firstDay)
    .lte("fecha", lastDay);

  type Row = { categoria: string; valor_original: number; valor_gon?: number; valor_pau?: number; quien_pago: string };
  const rows = (data ?? []) as Row[];

  const totalOriginal = rows.reduce((s, r) => s + r.valor_original, 0);
  const totalPersona = rows.reduce((s, r) => s + ((isGon ? r.valor_gon : r.valor_pau) ?? 0), 0);

  const map = new Map<string, { total: number; hasAmbos: boolean; hasPersonal: boolean }>();
  for (const r of rows) {
    const e = map.get(r.categoria) ?? { total: 0, hasAmbos: false, hasPersonal: false };
    e.total += r.valor_original;
    if (r.quien_pago === "ambos") e.hasAmbos = true;
    else e.hasPersonal = true;
    map.set(r.categoria, e);
  }

  const categories: CategoryTotal[] = Array.from(map.entries())
    .map(([name, { total, hasAmbos, hasPersonal }]) => ({
      name,
      total,
      type: (hasAmbos && !hasPersonal ? "ambos" : !hasAmbos && hasPersonal ? person : "ambos") as CategoryTotal["type"],
    }))
    .sort((a, b) => b.total - a.total);

  return { totalOriginal, totalPersona, categories, error };
}
