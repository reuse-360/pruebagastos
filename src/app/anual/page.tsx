"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAnnualData } from "@/lib/queries";
import { formatCLP } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

type Person = "gon" | "pau";

const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const nativeSelectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const LINE_COLORS = [
  "#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6",
  "#8b5cf6","#f97316","#14b8a6","#ec4899","#84cc16",
];

async function loadOptimos(persona: Person): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("optimos_mensuales")
    .select("categoria, valor")
    .eq("persona", persona);
  const result: Record<string, number> = {};
  for (const row of (data ?? []) as { categoria: string; valor: number }[]) {
    result[row.categoria] = row.valor;
  }
  return result;
}

async function saveOptimo(persona: Person, categoria: string, valor: number) {
  if (valor === 0) {
    await supabase.from("optimos_mensuales").delete().eq("persona", persona).eq("categoria", categoria);
  } else {
    await supabase.from("optimos_mensuales").upsert({ persona, categoria, valor });
  }
}

function PersonToggle({ value, onChange }: { value: Person; onChange: (p: Person) => void }) {
  return (
    <div className="flex rounded-md border border-input overflow-hidden text-sm font-medium">
      {(["gon", "pau"] as Person[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-4 py-2 transition-colors flex flex-col items-center leading-tight ${
            value === p ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          <span className="text-sm font-medium">{p === "gon" ? "Gon" : "Pau"}</span>
          <span className="text-xs opacity-70">{p === "gon" ? "(64%)" : "(36%)"}</span>
        </button>
      ))}
    </div>
  );
}

function OptInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState(value > 0 ? String(value) : "");

  useEffect(() => { setRaw(value > 0 ? String(value) : ""); }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      onChange={(e) => setRaw(e.target.value.replace(/\D/g, ""))}
      onBlur={() => {
        const num = parseInt(raw) || 0;
        onChange(num);
        setRaw(num > 0 ? String(num) : "");
      }}
      className="w-28 text-right bg-transparent border-b border-dashed border-muted-foreground/30 focus:border-primary focus:outline-none px-1 py-0.5 text-sm tabular-nums"
      placeholder="—"
    />
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2 text-xs shadow-md space-y-1 min-w-[140px]">
      <p className="font-semibold text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex justify-between gap-3">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium tabular-nums">{formatCLP(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function AnualPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [person, setPerson] = useState<Person>("gon");
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAnnualData>> | null>(null);
  const [optimos, setOptimos] = useState<Record<string, number>>({});
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [result, opts] = await Promise.all([
      fetchAnnualData(year, person),
      loadOptimos(person),
    ]);
    setData(result);
    setOptimos(opts);
    // Pre-select all categories that have data
    const withData = result.categories.filter((cat) => (result.categoryTotals[cat] ?? 0) > 0);
    setSelectedCats(new Set(withData));
    setLoading(false);
  }, [year, person]);

  useEffect(() => { load(); }, [load]);

  async function updateOptimo(categoria: string, value: number) {
    const updated = { ...optimos, [categoria]: value };
    if (value === 0) delete updated[categoria];
    setOptimos(updated);
    await saveOptimo(person, categoria, value);
  }

  function toggleCat(cat: string) {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // Todas las categorías, con o sin gastos
  const allCategories = data?.categories ?? [];
  const totalOptimos = allCategories.reduce((s, cat) => s + (optimos[cat] ?? 0), 0);

  // Para el gráfico solo mostrar las que tienen datos
  const catsConDatos = allCategories.filter((cat) => (data?.categoryTotals[cat] ?? 0) > 0);

  const chartData = MESES_CORTOS.map((mes, m) => {
    const point: Record<string, number | string> = { mes };
    for (const cat of selectedCats) {
      point[cat] = data?.monthly[cat]?.[m] ?? 0;
    }
    return point;
  });

  const selectedArr = Array.from(selectedCats);

  return (
    <main className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Anual</h1>
        <select
          className={nativeSelectClass}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Ver perspectiva de:</span>
        <PersonToggle value={person} onChange={setPerson} />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="text-sm min-w-max w-full">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="sticky left-0 bg-muted/50 z-10 text-left px-3 py-2 font-medium min-w-[140px] border-r">
                Categoría
              </th>
              {MESES_CORTOS.map((m) => (
                <th key={m} className="text-right px-2 py-2 font-medium min-w-[68px]">{m}</th>
              ))}
              <th className="text-right px-3 py-2 font-medium min-w-[88px] border-l">Total</th>
              <th className="sticky right-[60px] bg-muted/50 z-10 text-right px-3 py-2 font-medium min-w-[108px] border-l border-r">Óptimo mensual</th>
              <th className="sticky right-0 bg-muted/50 z-10 text-right px-3 py-2 font-medium min-w-[60px]">%</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={16} className="px-3 py-10 text-center text-muted-foreground">Cargando…</td>
              </tr>
            ) : allCategories.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-3 py-10 text-center text-muted-foreground">Sin categorías configuradas</td>
              </tr>
            ) : allCategories.map((cat, idx) => {
              const months = data!.monthly[cat] ?? Array(12).fill(0);
              const catTotal = data!.categoryTotals[cat] ?? 0;
              const optimo = optimos[cat] ?? 0;
              const pct = totalOptimos > 0 && optimo > 0 ? (optimo / totalOptimos * 100).toFixed(1) : null;
              const rowBg = idx % 2 === 1 ? "bg-muted/10" : "";
              return (
                <tr key={cat} className={`border-b last:border-0 ${rowBg}`}>
                  <td className={`sticky left-0 z-10 px-3 py-2 font-medium whitespace-nowrap border-r ${idx % 2 === 1 ? "bg-muted/10" : "bg-background"}`}>
                    {cat}
                  </td>
                  {months.map((v, m) => (
                    <td key={m} className="px-2 py-2 text-right whitespace-nowrap tabular-nums text-xs">
                      {v > 0 ? formatCLP(v) : <span className="text-muted-foreground/30">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums border-l">
                    {catTotal > 0 ? formatCLP(catTotal) : <span className="text-muted-foreground/30">—</span>}
                  </td>
                  <td className={`sticky right-[60px] z-10 px-3 py-2 text-right border-l border-r ${idx % 2 === 1 ? "bg-muted/10" : "bg-background"}`}>
                    <OptInput value={optimo} onChange={(v) => updateOptimo(cat, v)} />
                  </td>
                  <td className={`sticky right-0 z-10 px-3 py-2 text-right text-muted-foreground text-xs whitespace-nowrap ${idx % 2 === 1 ? "bg-muted/10" : "bg-background"}`}>
                    {pct ? `${pct}%` : <span className="text-muted-foreground/30">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {!loading && data && (
            <tfoot>
              <tr className="border-t bg-muted/40 font-semibold">
                <td className="sticky left-0 bg-muted/40 z-10 px-3 py-2 border-r">TOTAL</td>
                {data.monthTotals.map((v, m) => (
                  <td key={m} className="px-2 py-2 text-right whitespace-nowrap tabular-nums text-xs">
                    {v > 0 ? formatCLP(v) : <span className="text-muted-foreground/30">—</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-bold whitespace-nowrap tabular-nums border-l">
                  {formatCLP(data.grandTotal)}
                </td>
                <td className="sticky right-[60px] bg-muted/40 z-10 px-3 py-2 text-right border-l border-r font-semibold tabular-nums text-xs">
                  {totalOptimos > 0 ? formatCLP(totalOptimos) : ""}
                </td>
                <td className="sticky right-0 bg-muted/40 z-10 px-3 py-2 text-right text-xs">
                  {totalOptimos > 0 ? "100%" : ""}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Gráfico de evolución */}
      {!loading && catsConDatos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Evolución mensual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {catsConDatos.map((cat, i) => {
                const color = LINE_COLORS[i % LINE_COLORS.length];
                const active = selectedCats.has(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCat(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      active ? "text-white border-transparent" : "text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/60"
                    }`}
                    style={active ? { background: color, borderColor: color } : {}}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {selectedArr.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Haz clic en una categoría para mostrarla
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10 }}
                    width={48}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {selectedArr.map((cat, i) => (
                    <Line
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stroke={LINE_COLORS[catsConDatos.indexOf(cat) % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
