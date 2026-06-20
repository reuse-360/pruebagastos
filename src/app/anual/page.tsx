"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAnnualData } from "@/lib/queries";
import { formatCLP } from "@/lib/constants";

type Person = "gon" | "pau";

const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const nativeSelectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const STORAGE_KEY = "gastos_optimos";

function loadOptimos(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}

function saveOptimos(data: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

export default function AnualPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [person, setPerson] = useState<Person>("gon");
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAnnualData>> | null>(null);
  const [optimos, setOptimos] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { setOptimos(loadOptimos()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await fetchAnnualData(year, person));
    setLoading(false);
  }, [year, person]);

  useEffect(() => { load(); }, [load]);

  function updateOptimo(categoria: string, value: number) {
    const updated = { ...optimos, [categoria]: value };
    if (value === 0) delete updated[categoria];
    setOptimos(updated);
    saveOptimos(updated);
  }

  const visibleCategories = (data?.categories ?? []).filter(
    (cat) => (data?.categoryTotals[cat] ?? 0) > 0 || (optimos[cat] ?? 0) > 0
  );

  const totalOptimos = visibleCategories.reduce((s, cat) => s + (optimos[cat] ?? 0), 0);

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
              <th className="text-right px-3 py-2 font-medium min-w-[108px] border-l">Óptimo anual</th>
              <th className="text-right px-3 py-2 font-medium min-w-[60px]">%</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={16} className="px-3 py-10 text-center text-muted-foreground">Cargando…</td>
              </tr>
            ) : visibleCategories.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-3 py-10 text-center text-muted-foreground">Sin datos para {year}</td>
              </tr>
            ) : visibleCategories.map((cat, idx) => {
              const months = data!.monthly[cat];
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
                  <td className="px-3 py-2 text-right border-l">
                    <OptInput value={optimo} onChange={(v) => updateOptimo(cat, v)} />
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground text-xs whitespace-nowrap">
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
                <td className="px-3 py-2 text-right border-l font-semibold tabular-nums text-xs">
                  {totalOptimos > 0 ? formatCLP(totalOptimos) : ""}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  {totalOptimos > 0 ? "100%" : ""}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totalOptimos === 0 && !loading && visibleCategories.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Podés ingresar un óptimo anual por categoría en la columna de la derecha — se guarda en tu dispositivo.
        </p>
      )}
    </main>
  );
}
