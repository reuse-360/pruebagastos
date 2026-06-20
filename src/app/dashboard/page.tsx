"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDashboardData, type CategoryTotal } from "@/lib/queries";
import { formatCLP, MESES } from "@/lib/constants";

type Person = "gon" | "pau";

const nativeSelectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const COLORS = { ambos: "#6366f1", gon: "#3b82f6", pau: "#f59e0b" };

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function PersonToggle({ value, onChange }: { value: Person; onChange: (p: Person) => void }) {
  return (
    <div className="flex rounded-md border border-input overflow-hidden text-sm font-medium">
      {(["gon", "pau"] as Person[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-4 py-2 transition-colors flex flex-col items-center leading-tight ${
            value === p
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          <span className="text-sm font-medium">{p === "gon" ? "Gon" : "Pau"}</span>
          <span className="text-xs opacity-70">{p === "gon" ? "(64%)" : "(36%)"}</span>
        </button>
      ))}
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CategoryTotal & { value: number } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background p-2 text-xs shadow-md space-y-0.5">
      <p className="font-semibold">{d.name}</p>
      <p>Total: {formatCLP(d.total)}</p>
      <p className="text-muted-foreground capitalize">
        {d.type === "ambos" ? "Compartido" : d.type === "gon" ? "Solo Gon" : "Solo Pau"}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [person, setPerson] = useState<Person>("gon");
  const [totalOriginal, setTotalOriginal] = useState(0);
  const [totalPersona, setTotalPersona] = useState(0);
  const [categories, setCategories] = useState<CategoryTotal[]>([]);
  const [totalPrev, setTotalPrev] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const prev = prevMonth(year, month);
    const [curr, previous] = await Promise.all([
      fetchDashboardData(year, month, person),
      fetchDashboardData(prev.year, prev.month, person),
    ]);
    setTotalOriginal(curr.totalOriginal);
    setTotalPersona(curr.totalPersona);
    setCategories(curr.categories);
    setTotalPrev(previous.totalOriginal);
    setLoading(false);
  }, [year, month, person]);

  useEffect(() => { load(); }, [load]);

  const isPau = person === "pau";
  const accentClass = isPau ? "text-amber-600" : "text-indigo-600";
  const monthDiff = totalPrev !== null ? totalOriginal - totalPrev : null;
  const chartData = categories.map((c) => ({ ...c, value: c.total }));

  return (
    <main className="container mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="flex gap-2 flex-wrap items-center">
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

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Ver perspectiva de:</span>
        <PersonToggle value={person} onChange={setPerson} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Total del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{loading ? "—" : formatCLP(totalOriginal)}</p>
            {monthDiff !== null && !loading && (
              <p className={`text-xs mt-0.5 ${monthDiff > 0 ? "text-red-500" : "text-green-600"}`}>
                {monthDiff > 0 ? "▲" : "▼"} {formatCLP(Math.abs(monthDiff))} vs mes anterior
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className={`text-xs ${accentClass}`}>
              {isPau ? "Total Pau" : "Total Gon"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-bold ${accentClass}`}>
              {loading ? "—" : formatCLP(totalPersona)}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Categorías</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-semibold">{loading ? "—" : categories.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.ambos }} />Compartido
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.gon }} />Solo Gon
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.pau }} />Solo Pau
        </span>
      </div>

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
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={44} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.type]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
