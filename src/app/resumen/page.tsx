"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchGastosGon, fetchGastosPau, type TxRow } from "@/lib/queries";
import { formatCLP, SPLIT_GON, SPLIT_PAU, MESES } from "@/lib/constants";

type Person = "gon" | "pau";

const nativeSelectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${MESES_CORTOS[parseInt(m) - 1]}`;
}

function MonthSelector({
  year, month, onChange,
}: {
  year: number; month: number; onChange: (y: number, m: number) => void;
}) {
  return (
    <div className="flex gap-2">
      <select
        className={nativeSelectClass}
        value={month}
        onChange={(e) => onChange(year, Number(e.target.value))}
      >
        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <select
        className={nativeSelectClass}
        value={year}
        onChange={(e) => onChange(Number(e.target.value), month)}
      >
        {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
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

function buildCopyText(month: number, year: number, rows: TxRow[], person: Person): string {
  const nombre = person === "gon" ? "Gon" : "Pau";
  const pct = person === "gon" ? SPLIT_GON : SPLIT_PAU;
  const lines: string[] = [
    `Resumen ${MESES[month - 1]} ${year} — ${nombre}`,
    "──────────────────────────────────────",
  ];
  for (const r of rows) {
    const isShared = r.quien_pago === "ambos";
    const desc = r.descripcion ? ` · ${r.descripcion}` : "";
    const monto = isShared ? ` · ${formatCLP(r.valor_original)}` : "";
    const label = isShared ? `${r.categoria} (${Math.round(pct * 100)}%)` : r.categoria;
    lines.push(`${label}${desc}${monto} → ${formatCLP(r.valor_persona)}  ${formatDate(r.fecha)}`);
  }
  lines.push("──────────────────────────────────────");
  lines.push(`TOTAL ${nombre.toUpperCase()}: ${formatCLP(rows.reduce((s, r) => s + r.valor_persona, 0))}`);
  return lines.join("\n");
}

// Sin separador de miles: Google Sheets a veces está en configuración regional
// donde el punto es separador decimal, y "$110.000" (formato chileno) se
// reinterpreta como $110.00, perdiendo los "0". Un número plano evita la ambigüedad.
function plainCLP(amount: number): string {
  return `$${Math.round(amount)}`;
}

function buildCopyHtml(month: number, year: number, rows: TxRow[], person: Person): string {
  const nombre = person === "gon" ? "Gon" : "Pau";
  const pct = person === "gon" ? SPLIT_GON : SPLIT_PAU;
  const shareLabel = person === "gon" ? "Total Gon" : "Total Pau";
  const total = rows.reduce((s, r) => s + r.valor_persona, 0);
  const totalOriginal = rows.reduce((s, r) => s + r.valor_original, 0);

  const tdStyle = "padding:6px 12px;border:1px solid #e2e8f0;font-weight:normal;";
  const thStyle = "padding:6px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;text-align:left;";
  const numStyle = `${tdStyle}text-align:right;`;
  const numThStyle = `${thStyle}text-align:right;`;

  const headerRow = `<tr>
    <th style="${thStyle}">Categoría</th>
    <th style="${thStyle}">Descripción</th>
    <th style="${numThStyle}">Valor original</th>
    <th style="${numThStyle}">${shareLabel}</th>
    <th style="${numThStyle}">Fecha</th>
  </tr>`;

  const bodyRows = rows.map((r) => {
    const isShared = r.quien_pago === "ambos";
    const catLabel = isShared ? `${r.categoria} (${Math.round(pct * 100)}%)` : r.categoria;
    return `<tr>
      <td style="${tdStyle}">${catLabel}</td>
      <td style="${tdStyle}">${r.descripcion ?? ""}</td>
      <td style="${numStyle}">${plainCLP(r.valor_original)}</td>
      <td style="${numStyle}">${plainCLP(r.valor_persona)}</td>
      <td style="${numStyle}">${formatDate(r.fecha)}</td>
    </tr>`;
  }).join("\n");

  const footerRow = `<tr>
    <td style="${tdStyle}font-weight:bold;">TOTAL ${nombre.toUpperCase()}</td>
    <td style="${tdStyle}"></td>
    <td style="${numStyle}font-weight:bold;">${plainCLP(totalOriginal)}</td>
    <td style="${numStyle}font-weight:bold;">${plainCLP(total)}</td>
    <td style="${tdStyle}"></td>
  </tr>`;

  return `<h3 style="font-family:sans-serif;margin-bottom:8px;">Resumen ${MESES[month - 1]} ${year} — ${nombre}</h3>
<table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
  <thead>${headerRow}</thead>
  <tbody>${bodyRows}
${footerRow}</tbody>
</table>`;
}

function TxTable({ rows, person }: { rows: TxRow[]; person: Person }) {
  const isPau = person === "pau";
  const accentClass = isPau ? "text-amber-600" : "text-indigo-600";
  const shareLabel = isPau ? "Total Pau" : "Total Gon";
  const total = rows.reduce((s, r) => s + r.valor_persona, 0);
  const valorOriginalTotal = rows.reduce((s, r) => s + r.valor_original, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Detalle de gastos</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left px-3 py-2 font-medium">Categoría</th>
                <th className="text-left px-3 py-2 font-medium">Descripción</th>
                <th className="text-right px-3 py-2 font-medium">Valor original</th>
                <th className={`text-right px-3 py-2 font-medium ${accentClass}`}>{shareLabel}</th>
                <th className="text-right px-3 py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isShared = r.quien_pago === "ambos";
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{r.categoria}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.descripcion ?? ""}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {formatCLP(r.valor_original)}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${accentClass}`}>
                      {formatCLP(r.valor_persona)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {formatDate(r.fecha)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 text-sm font-semibold">
                <td colSpan={2} className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatCLP(valorOriginalTotal)}
                </td>
                <td className={`px-3 py-2 text-right whitespace-nowrap font-bold ${accentClass}`}>
                  {formatCLP(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResumenPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [person, setPerson] = useState<Person>("pau");
  const [gonRows, setGonRows] = useState<TxRow[]>([]);
  const [pauRows, setPauRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [gon, pau] = await Promise.all([
      fetchGastosGon(year, month),
      fetchGastosPau(year, month),
    ]);
    setGonRows(gon.rows);
    setPauRows(pau.rows);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const isPau = person === "pau";
  const rows = isPau ? pauRows : gonRows;

  const totalPersona = rows.reduce((s, r) => s + r.valor_persona, 0);
  const valorOriginalTotal = rows.reduce((s, r) => s + r.valor_original, 0);

  async function handleCopy() {
    const text = buildCopyText(month, year, rows, person);
    const html = buildCopyHtml(month, year, rows, person);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="container mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Resumen mensual</h1>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
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
            <p className="text-lg font-bold">
              {loading ? "—" : formatCLP(valorOriginalTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">
              {isPau ? "Total Pau" : "Total Gon"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-bold ${isPau ? "text-amber-600" : "text-indigo-600"}`}>
              {loading ? "—" : formatCLP(totalPersona)}
            </p>
          </CardContent>
        </Card>
      </div>

      {!loading && rows.length > 0 && <TxTable rows={rows} person={person} />}

      {!loading && rows.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Sin transacciones este mes.</p>
      )}

      {!loading && rows.length > 0 && (
        <Button className="w-full" variant="outline" onClick={handleCopy}>
          {copied ? "¡Copiado!" : `Copiar resumen de ${isPau ? "Pau" : "Gon"}`}
        </Button>
      )}
    </main>
  );
}
