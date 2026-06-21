import { supabase } from "./supabase";

export interface Sugerencia {
  id: string;
  comercio: string;
  monto: number;
  texto_original: string | null;
  fecha: string;
  estado: "pendiente" | "guardado" | "ignorado";
}

export async function fetchSugerenciasPendientes(): Promise<Sugerencia[]> {
  const { data } = await supabase
    .from("sugerencias")
    .select("*")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: true });
  return (data ?? []) as Sugerencia[];
}

export async function marcarSugerencia(id: string, estado: "guardado" | "ignorado") {
  await supabase.from("sugerencias").update({ estado }).eq("id", id);
}

// Parsea texto_original del correo para extraer datos limpios
export function parsearTextoSugerencia(texto: string | null): {
  origen: string | null;
  destino: string | null;
  fechaTransferencia: string | null;
  comentario: string | null;
} {
  if (!texto) return { origen: null, destino: null, fechaTransferencia: null, comentario: null };

  // "nuestro cliente NOMBRE realizó una transferencia"
  const origenMatch = texto.match(/nuestro cliente\s+(.+?)\s+realizó/i);
  const origen = origenMatch ? origenMatch[1].trim() : null;

  // "Datos de destino Nombre NOMBRE RUT..."
  const destinoMatch = texto.match(/Datos de destino\s+Nombre\s+(.*?)\s+RUT/i);
  const destino = destinoMatch ? destinoMatch[1].trim() : null;

  // "con fecha DD/MM/YYYY"
  const fechaMatch = texto.match(/con fecha\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  let fechaTransferencia: string | null = null;
  if (fechaMatch) {
    const [d, m, y] = fechaMatch[1].split("/");
    fechaTransferencia = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // "Comentario TEXTO Antes de imprimir..." o "Comentario TEXTO Nota:"
  const comentarioMatch = texto.match(/Comentario\s+(.*?)(?:\s+Antes de|\s+Nota:|$)/i);
  const comentario = comentarioMatch ? comentarioMatch[1].trim() : null;

  return { origen, destino, fechaTransferencia, comentario };
}

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

export interface AnnualResult {
  categories: string[];
  monthly: Record<string, number[]>; // categoria -> [12 meses]
  monthTotals: number[];             // total por mes
  categoryTotals: Record<string, number>; // total anual por categoria
  grandTotal: number;
  error: unknown;
}

export async function fetchAnnualData(year: number, person: "gon" | "pau"): Promise<AnnualResult> {
  const [txResult, catResult] = await Promise.all([
    supabase
      .from(person === "gon" ? "gastos_gon" : "gastos_pau")
      .select("fecha, categoria, valor_original")
      .gte("fecha", `${year}-01-01`)
      .lte("fecha", `${year}-12-31`),
    supabase
      .from("expense_categories")
      .select("name")
      .eq("active", true)
      .order("name"),
  ]);

  const txData = (txResult.data ?? []) as Array<{ fecha: string; categoria: string; valor_original: number }>;
  const categories: string[] = (catResult.data ?? []).map((r: { name: string }) => r.name);

  // include categories from transactions not in the master list
  for (const r of txData) {
    if (!categories.includes(r.categoria)) categories.push(r.categoria);
  }
  categories.sort();

  const monthly: Record<string, number[]> = {};
  for (const cat of categories) monthly[cat] = Array(12).fill(0);

  for (const r of txData) {
    const m = parseInt(r.fecha.split("-")[1]) - 1;
    monthly[r.categoria][m] += r.valor_original;
  }

  const monthTotals = Array.from({ length: 12 }, (_, m) =>
    categories.reduce((s, cat) => s + monthly[cat][m], 0)
  );
  const categoryTotals: Record<string, number> = {};
  for (const cat of categories) categoryTotals[cat] = monthly[cat].reduce((s, v) => s + v, 0);
  const grandTotal = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

  return { categories, monthly, monthTotals, categoryTotals, grandTotal, error: txResult.error ?? catResult.error };
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
