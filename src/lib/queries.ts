import { supabase } from "./supabase";

export interface CategorySummary {
  name: string;
  is_shared: boolean;
  total: number;
}

export interface TransactionDetail {
  amount: number;
  description: string | null;
  transaction_date: string;
  category_name: string;
  is_shared: boolean;
}

function dateRange(year: number, month: number) {
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayDate = new Date(year, month, 0);
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;
  return { firstDay, lastDay };
}

type Row = {
  amount: number;
  description: string | null;
  transaction_date: string;
  expense_categories: { name: string; is_shared: boolean } | { name: string; is_shared: boolean }[] | null;
};

function resolveCategory(raw: Row["expense_categories"]) {
  return Array.isArray(raw) ? raw[0] : raw;
}

export async function fetchMonthlySummary(year: number, month: number) {
  const { firstDay, lastDay } = dateRange(year, month);

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, expense_categories(name, is_shared)")
    .gte("transaction_date", firstDay)
    .lte("transaction_date", lastDay);

  if (error || !data) return { categories: [], totalMonth: 0, error };

  const map = new Map<string, CategorySummary>();
  for (const t of data as unknown as Row[]) {
    const cat = resolveCategory(t.expense_categories);
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

export async function fetchAllTransactions(year: number, month: number) {
  const { firstDay, lastDay } = dateRange(year, month);

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, description, transaction_date, expense_categories(name, is_shared)")
    .gte("transaction_date", firstDay)
    .lte("transaction_date", lastDay)
    .order("transaction_date", { ascending: true });

  if (error || !data) return { transactions: [] as TransactionDetail[], error };

  const transactions: TransactionDetail[] = [];
  for (const t of data as unknown as Row[]) {
    const cat = resolveCategory(t.expense_categories);
    if (!cat) continue;
    transactions.push({
      amount: t.amount,
      description: t.description,
      transaction_date: t.transaction_date,
      category_name: cat.name,
      is_shared: cat.is_shared,
    });
  }

  return { transactions, error: null };
}
