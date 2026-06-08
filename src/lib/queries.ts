import { supabase } from "./supabase";

export interface CategorySummary {
  name: string;
  is_shared: boolean;
  total: number;
}

export async function fetchMonthlySummary(year: number, month: number) {
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayDate = new Date(year, month, 0);
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, expense_categories(name, is_shared)")
    .gte("transaction_date", firstDay)
    .lte("transaction_date", lastDay);

  if (error || !data) return { categories: [], totalMonth: 0, error };

  type Row = { amount: number; expense_categories: { name: string; is_shared: boolean } | { name: string; is_shared: boolean }[] | null };
  const map = new Map<string, CategorySummary>();
  for (const t of data as unknown as Row[]) {
    const raw = t.expense_categories;
    const cat = Array.isArray(raw) ? raw[0] : raw;
    if (!cat) continue;
    const existing = map.get(cat.name);
    if (existing) {
      existing.total += t.amount;
    } else {
      map.set(cat.name, { name: cat.name, is_shared: cat.is_shared, total: t.amount });
    }
  }

  const categories = Array.from(map.values()).sort((a, b) => b.total - a.total);
  const totalMonth = categories.reduce((s, c) => s + c.total, 0);

  return { categories, totalMonth, error: null };
}
