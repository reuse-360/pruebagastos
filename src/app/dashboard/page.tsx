"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMonthlySummary, type CategorySummary } from "@/lib/queries";
import { formatCLP, pauShare, MESES } from "@/lib/constants";

const nativeSelectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

const COLORS = { shared: "#6366f1", personal: "#f59e0b", pau: "#ec4899" };

function getBarColor(cat: CategorySummary) {
  if (cat.is_shared) return COLORS.shared;
  if (cat.name === "Pau") return COLORS.pau;
  return COLORS.personal;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CategorySummary & { value: number } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const share = pauShare(d.total, d.is_shared, d.name);
  return (
    <div className="rounded-lg border bg-background p-2 text-xs shadow-md space-y-0.5">
      <p className="font-semibold">{d.name}</p>
      <p>Total: {formatCLP(d.total)}</p>
      {share > 0 && <p className="text-amber-600">Pau: {formatCLP(share)}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [totalMonth, setTotalMonth] = useState(0);
  const [totalPrev, setTotalPrev] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const prev = prevMonth(year, month);
    const [curr, previous] = await Promise.all([
      fetchMonthlySummary(year, month),
      fetchMonthlySummary(prev.year, prev.month),
    ]);
    setCategories(curr.categories);
    setTotalMonth(curr.totalMonth);
    setTotalPrev(previous.totalMonth);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const totalShared = categories.filter((c) => c.is_shared).reduce((s, c) => s + c.total, 0);
  const totalPersonal = categories.filter((c) => !c.is_shared).reduce((s, c) => s + c.total, 0);
  const totalPauOwes = categories.reduce((s, c) => s + pauShare(c.total, c.is_shared, c.name), 0);
  const monthDiff = totalPrev !== null ? totalMonth - totalPrev : null;

  const chartData = categories.map((c) => ({ ...c, value: c.total }));

  return (
    <main className="container mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <select
            className={nativeSelectClass}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            className={nativeSelectClass}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Total del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{loading ? "—" : formatCLP(totalMonth)}</p>
            {monthDiff !== null && !loading && (
              <p className={`text-xs mt-0.5 ${monthDiff > 0 ? "text-red-500" : "text-green-600"}`}>
                {monthDiff > 0 ? "▲" : "▼"} {formatCLP(Math.abs(monthDiff))} vs mes anterior
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Pau debe</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-amber-600">{loading ? "—" : formatCLP(totalPauOwes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Compartidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-semibold text-indigo-600">{loading ? "—" : formatCLP(totalShared)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Personales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-semibold text-amber-500">{loading ? "—" : formatCLP(totalPersonal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.shared }} />Compartido</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.personal }} />Personal</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.pau }} />Pau</span>
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Gasto por categoría</CardTitle>
        </CardHeader>
        <CardContent className="pl-0 pr-2">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Cargando…</div>
          ) : categories.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10 }}
                  width={44}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={getBarColor(entry)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {!loading && categories.length === 0 && (
        <p className="text-center text-muted-foreground py-4">Sin transacciones este mes.</p>
      )}
    </main>
  );
}
