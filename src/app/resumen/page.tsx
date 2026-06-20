"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchAllTransactions, type TransactionDetail } from "@/lib/queries";
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
        {MESES.map((m, i) => (
          <option key={i} value={i + 1}>{m}</option>
        ))}
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

function pauOwes(t: TransactionDetail): number {
  return t.is_shared ? t.amount * SPLIT_PAU : t.amount;
}

function gonOwes(t: TransactionDetail): number {
  if (!t.is_shared && t.category_name === "Pau") return 0;
  if (t.is_shared) return t.amount * SPLIT_GON;
  return t.amount;
}

function buildCopyTextPau(month: number, year: number, txs: TransactionDetail[], total: number): string {
  const lines: string[] = [
    `Resumen ${MESES[month - 1]} ${year} — Pau`,
    "──────────────────────────────────────",
  ];
  for (const t of txs) {
    const desc = t.description ? ` · ${t.description}` : "";
    const monto = t.is_shared ? ` · ${formatCLP(t.amount)}` : "";
    const label = t.is_shared ? `${t.category_name} (36%)` : t.category_name;
    lines.push(`${label}${desc}${monto} → ${formatCLP(pauOwes(t))}  ${formatDate(t.transaction_date)}`);
  }
  lines.push("──────────────────────────────────────");
  lines.push(`TOTAL QUE DEBES: ${formatCLP(total)}`);
  return lines.join("\n");
}

function buildCopyTextGon(month: number, year: number, txs: TransactionDetail[], total: number): string {
  const lines: string[] = [
    `Resumen ${MESES[month - 1]} ${year} — Gon`,
    "──────────────────────────────────────",
  ];
  for (const t of txs) {
    if (!t.is_shared && t.category_name === "Pau") continue;
    const desc = t.description ? ` · ${t.description}` : "";
    const monto = t.is_shared ? ` · ${formatCLP(t.amount)}` : "";
    const label = t.is_shared ? `${t.category_name} (64%)` : t.category_name;
    lines.push(`${label}${desc}${monto} → ${formatCLP(gonOwes(t))}  ${formatDate(t.transaction_date)}`);
  }
  lines.push("──────────────────────────────────────");
  lines.push(`TOTAL GON: ${formatCLP(total)}`);
  return lines.join("\n");
}

interface TxTableProps {
  txs: TransactionDetail[];
  person: Person;
  total: number;
}

function TxTable({ txs, person, total }: TxTableProps) {
  const isPau = person === "pau";
  const owes = isPau ? pauOwes : gonOwes;
  const shareLabel = isPau ? "Total Pau" : "Total Gon";
  const accentClass = isPau ? "text-amber-600" : "text-indigo-600";

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
              {txs.map((t, i) => {
                const isPauCat = !t.is_shared && t.category_name === "Pau";
                const owed = owes(t);
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {t.category_name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t.description ?? ""}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {/* Valor original vacío si: vista Pau + categoría Pau, o vista Gon + categoría Pau */}
                      {isPauCat ? <span className="text-muted-foreground">—</span> : formatCLP(t.amount)}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${owed > 0 ? accentClass : "text-muted-foreground"}`}>
                      {owed > 0 ? formatCLP(owed) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {formatDate(t.transaction_date)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={3} className="px-3 py-2 font-semibold text-sm">TOTAL</td>
                <td className={`px-3 py-2 text-right font-bold text-sm whitespace-nowrap ${accentClass}`}>
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

  const [allTxs, setAllTxs] = useState<TransactionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const txResult = await fetchAllTransactions(year, month);
    setAllTxs(txResult.transactions);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const isPau = person === "pau";

  const pauTxs = allTxs.filter((t) => t.is_shared || t.category_name === "Pau");
  const gonTxs = allTxs.filter((t) => t.is_shared || t.category_name !== "Pau");

  const pauTotal = pauTxs.reduce((s, t) => s + pauOwes(t), 0);
  const gonTotal = gonTxs.reduce((s, t) => s + gonOwes(t), 0);

  const visibleTxs = isPau ? pauTxs : gonTxs;
  const visibleTotal = isPau ? pauTotal : gonTotal;

  // "Total del mes" = suma de la columna Valor original (excluye filas con "—")
  const valorOriginalTotal = visibleTxs.reduce((s, t) => {
    const isPauCat = !t.is_shared && t.category_name === "Pau";
    return s + (isPauCat ? 0 : t.amount);
  }, 0);

  async function handleCopy() {
    const text = isPau
      ? buildCopyTextPau(month, year, pauTxs, pauTotal)
      : buildCopyTextGon(month, year, gonTxs, gonTotal);
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

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">Ver perspectiva de:</span>
        <PersonToggle value={person} onChange={setPerson} />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Total del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{loading ? "—" : formatCLP(valorOriginalTotal)}</p>
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
              {loading ? "—" : formatCLP(visibleTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de transacciones */}
      {!loading && visibleTxs.length > 0 && (
        <TxTable txs={visibleTxs} person={person} total={visibleTotal} />
      )}

      {!loading && allTxs.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Sin transacciones este mes.</p>
      )}

      {!loading && visibleTxs.length > 0 && (
        <Button className="w-full" variant="outline" onClick={handleCopy}>
          {copied ? "¡Copiado!" : `Copiar resumen de ${isPau ? "Pau" : "Gon"}`}
        </Button>
      )}
    </main>
  );
}
