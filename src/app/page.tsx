"use client";

import { useState, useEffect } from "react";
import { TransactionForm } from "@/components/TransactionForm";
import { fetchSugerenciasPendientes, marcarSugerencia, type Sugerencia } from "@/lib/queries";
import { formatCLP } from "@/lib/constants";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Home() {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSugerenciasPendientes().then((data) => {
      setSugerencias(data);
      setLoading(false);
    });
  }, []);

  const current = sugerencias[idx] ?? null;
  const total = sugerencias.length;
  const hayMas = idx < total - 1;

  async function handleSaved() {
    if (current) await marcarSugerencia(current.id, "guardado");
    avanzar();
  }

  async function handleIgnorar() {
    if (current) await marcarSugerencia(current.id, "ignorado");
    avanzar();
  }

  function avanzar() {
    if (hayMas) setIdx((i) => i + 1);
    else setIdx(total); // termina el flujo
  }

  const terminado = !loading && (!current);

  return (
    <main className="container mx-auto max-w-lg px-4 py-8 space-y-4">

      {/* Banner de sugerencias */}
      {!loading && total > 0 && !terminado && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">
              {total - idx} {total - idx === 1 ? "gasto pendiente" : "gastos pendientes"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Revisa y clasifica: <span className="font-medium">{current.comercio}</span> — {formatCLP(current.monto)}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{idx + 1}/{total}</span>
        </div>
      )}

      {terminado && total > 0 && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
            ¡Todo al día! Revisaste {total} {total === 1 ? "gasto" : "gastos"}.
          </p>
        </div>
      )}

      <TransactionForm
        key={current?.id ?? "manual"}
        onSaved={handleSaved}
        onSkip={current ? handleIgnorar : undefined}
        preload={current ? {
          amount: String(current.monto),
          description: current.comercio,
          date: current.fecha ?? todayISO(),
        } : undefined}
      />
    </main>
  );
}
