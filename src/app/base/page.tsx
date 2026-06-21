"use client";

import { redirect } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { formatCLP, MESES } from "@/lib/constants";

if (process.env.NEXT_PUBLIC_SHOW_BASE !== "true") {
  redirect("/");
}

type Person = "gon" | "pau";

const nativeSelectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatDate(d: string) {
  const [, m, day] = d.split("-");
  return `${parseInt(day)} ${MESES_CORTOS[parseInt(m) - 1]}`;
}

function quienLabel(q: string) {
  return q === "ambos" ? "Ambos" : q === "gon" ? "Gon" : "Pau";
}

interface RowGon {
  id: string; fecha: string; quien_pago: string; categoria: string;
  descripcion: string | null; valor_original: number; valor_gon: number;
}
interface RowPau {
  id: string; fecha: string; quien_pago: string; categoria: string;
  descripcion: string | null; valor_original: number; valor_pau: number;
}

function PushTester() {
  const [texto, setTexto] = useState("");
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function probar() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/sugerencias", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "reuse2002" },
        body: JSON.stringify({ texto }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (res.ok) {
        const fechaISO = data.fecha as string | undefined;
        const fechaFmt = fechaISO ? fechaISO.split("-").reverse().join("/") : "sin fecha";
        setResult({ ok: true, msg: `✓ Comercio: ${data.comercio} | Monto: $${(data.monto as number).toLocaleString("es-CL")} | Fecha: ${fechaFmt}` });
      } else {
        setResult({ ok: false, msg: `Error ${res.status}: ${data.error ?? JSON.stringify(data)}` });
      }
    } catch (e) {
      setResult({ ok: false, msg: String(e) });
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          Probar push notification
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">debug</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder='Pega aquí el texto de la notificación de Santander&#10;Ej: "Banco Santander transacción por $15.990 se realizó un pago con tu Tarjeta de Crédito ****7385 en SUPERMERCADO 20/06/2026 14:32:01"'
          className="w-full h-24 text-xs rounded-md border border-input bg-transparent px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={probar}
          disabled={!texto.trim() || loading}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Probando…" : "Probar"}
        </button>
        {result && (
          <p className={`text-xs rounded-md px-3 py-2 ${result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            {result.msg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function BasePage() {
  const now = new Date();
  const [person, setPerson] = useState<Person>("gon");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [allMonths, setAllMonths] = useState(false);
  const [rows, setRows] = useState<(RowGon | RowPau)[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const table = person === "gon" ? "gastos_gon" : "gastos_pau";

    let query = supabase
      .from(table)
      .select("*")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });

    if (!allMonths) {
      const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDayDate = new Date(year, month, 0);
      const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;
      query = query.gte("fecha", firstDay).lte("fecha", lastDay);
    }

    const { data } = await query;
    setRows((data ?? []) as (RowGon | RowPau)[]);
    setLoading(false);
  }, [person, year, month, allMonths]);

  useEffect(() => { load(); }, [load]);

  const isGon = person === "gon";
  const total = rows.reduce((s, r) => s + (isGon ? (r as RowGon).valor_gon : (r as RowPau).valor_pau), 0);
  const totalOriginal = rows.reduce((s, r) => s + r.valor_original, 0);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Base</h1>
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">debug</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle Gon/Pau */}
          <div className="flex rounded-md border border-input overflow-hidden text-sm font-medium">
            {(["gon", "pau"] as Person[]).map((p) => (
              <button
                key={p}
                onClick={() => setPerson(p)}
                className={`px-4 py-1.5 transition-colors ${
                  person === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {p === "gon" ? "Gon" : "Pau"}
              </button>
            ))}
          </div>

          {/* Filtro mes/año */}
          {!allMonths && (
            <>
              <select className={nativeSelectClass} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select className={nativeSelectClass} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}

          <button
            onClick={() => setAllMonths(!allMonths)}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              allMonths ? "bg-primary text-primary-foreground" : "text-muted-foreground border-input hover:bg-muted"
            }`}
          >
            {allMonths ? "Filtrando todo" : "Ver todo"}
          </button>
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Registros</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{loading ? "—" : rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">
              Total {isGon ? "Gon" : "Pau"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-bold ${isGon ? "text-indigo-600" : "text-amber-600"}`}>
              {loading ? "—" : formatCLP(total)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Test push notification */}
      <PushTester />

      {/* Tabla completa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            gastos_{person} {!allMonths && `— ${MESES[month - 1]} ${year}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left px-3 py-2 font-medium">Fecha</th>
                    <th className="text-left px-3 py-2 font-medium">Pagó</th>
                    <th className="text-left px-3 py-2 font-medium">Categoría</th>
                    <th className="text-left px-3 py-2 font-medium">Descripción</th>
                    <th className="text-right px-3 py-2 font-medium">Val. original</th>
                    <th className={`text-right px-3 py-2 font-medium ${isGon ? "text-indigo-600" : "text-amber-600"}`}>
                      {isGon ? "Gon" : "Pau"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const valorPersona = isGon ? (r as RowGon).valor_gon : (r as RowPau).valor_pau;
                    const isShared = r.quien_pago === "ambos";
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.fecha)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            r.quien_pago === "ambos" ? "bg-indigo-100 text-indigo-700" :
                            r.quien_pago === "gon" ? "bg-blue-100 text-blue-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {quienLabel(r.quien_pago)}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium">{r.categoria}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.descripcion ?? ""}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {formatCLP(r.valor_original)}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${isGon ? "text-indigo-600" : "text-amber-600"}`}>
                          {formatCLP(valorPersona)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold text-sm">
                    <td colSpan={4} className="px-3 py-2">TOTAL</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatCLP(totalOriginal)}</td>
                    <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${isGon ? "text-indigo-600" : "text-amber-600"}`}>
                      {formatCLP(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
