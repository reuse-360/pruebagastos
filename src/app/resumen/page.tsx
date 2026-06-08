"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchMonthlySummary, type CategorySummary } from "@/lib/queries";
import { formatCLP, pauShare, MESES } from "@/lib/constants";

const nativeSelectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function MonthSelector({
  year, month, onChange,
}: {
  year: number; month: number; onChange: (y: number, m: number) => void;
}) {
  const years = [2024, 2025, 2026, 2027];
  return (
    <div className="flex gap-2">
      <select
        className={nativeSelectClass}
        value={month}
        onChange={(e) => onChange(year, Number(e.target.value))}
      >
        {MESES.map((m, i) => (
          <option key={i} value={i + 1}>{m}</option>
        ))}
      </select>
      <select
        className={nativeSelectClass}
        value={year}
        onChange={(e) => onChange(Number(e.target.value), month)}
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

function buildResumenText(
  month: number, year: number, categories: CategorySummary[],
): string {
  const shared = categories.filter((c) => c.is_shared);
  const pau = categories.filter((c) => !c.is_shared && c.name === "Pau");

  const totalPau =
    shared.reduce((s, c) => s + c.total * 0.36, 0) +
    pau.reduce((s, c) => s + c.total, 0);

  const lines: string[] = [
    `Resumen ${MESES[month - 1]} ${year}`,
    "─────────────────────────",
  ];

  if (shared.length) {
    lines.push("Gastos compartidos (tu parte 36%):");
    for (const c of shared) {
      lines.push(`  ${c.name}: ${formatCLP(c.total)} → ${formatCLP(c.total * 0.36)}`);
    }
    lines.push(`  Subtotal: ${formatCLP(shared.reduce((s, c) => s + c.total * 0.36, 0))}`);
    lines.push("");
  }

  if (pau.length) {
    lines.push("Gastos Pau (100%):");
    for (const c of pau) {
      lines.push(`  ${c.name}: ${formatCLP(c.total)}`);
    }
    lines.push("");
  }

  lines.push(`TOTAL QUE DEBES: ${formatCLP(totalPau)}`);
  return lines.join("\n");
}

export default function ResumenPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [totalMonth, setTotalMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchMonthlySummary(year, month);
    setCategories(result.categories);
    setTotalMonth(result.totalMonth);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const shared = categories.filter((c) => c.is_shared);
  const personal = categories.filter((c) => !c.is_shared);
  const totalPauOwes = categories.reduce((s, c) => s + pauShare(c.total, c.is_shared, c.name), 0);

  async function handleCopy() {
    const text = buildResumenText(month, year, categories);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="container mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Resumen mensual</h1>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Total del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{loading ? "—" : formatCLP(totalMonth)}</p>
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
      </div>

      {/* Tabla compartidas */}
      {shared.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gastos compartidos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Categoría</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                  <th className="text-right px-4 py-2 font-medium">Pau (36%)</th>
                </tr>
              </thead>
              <tbody>
                {shared.map((c) => (
                  <tr key={c.name} className="border-b last:border-0">
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 text-right">{formatCLP(c.total)}</td>
                    <td className="px-4 py-2 text-right text-amber-600 font-medium">{formatCLP(c.total * 0.36)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Tabla personales */}
      {personal.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gastos personales</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Categoría</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                  <th className="text-right px-4 py-2 font-medium">Pau</th>
                </tr>
              </thead>
              <tbody>
                {personal.map((c) => (
                  <tr key={c.name} className="border-b last:border-0">
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 text-right">{formatCLP(c.total)}</td>
                    <td className="px-4 py-2 text-right">
                      {c.name === "Pau"
                        ? <span className="text-amber-600 font-medium">{formatCLP(c.total)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {!loading && categories.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Sin transacciones este mes.</p>
      )}

      {/* Botón generar resumen */}
      <Button
        className="w-full"
        variant="outline"
        onClick={handleCopy}
        disabled={categories.length === 0}
      >
        {copied ? "¡Copiado!" : "Generar resumen para Pau"}
      </Button>
    </main>
  );
}
