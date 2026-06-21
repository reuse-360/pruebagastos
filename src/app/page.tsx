"use client";

import { useState, useEffect } from "react";
import { TransactionForm } from "@/components/TransactionForm";
import { fetchSugerenciasPendientes, marcarSugerencia, parsearTextoSugerencia, type Sugerencia } from "@/lib/queries";
import { formatCLP } from "@/lib/constants";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

export default function Home() {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // Revisar Gmail al abrir, luego cargar pendientes
      try {
        const res = await fetch("/api/gmail", {
          method: "POST",
          headers: { "x-api-key": "reuse2002" },
        });
        const data = await res.json();
        if (data.nuevas > 0) {
          const updated = await fetchSugerenciasPendientes();
          setSugerencias(updated);
        } else {
          const pendientes = await fetchSugerenciasPendientes();
          setSugerencias(pendientes);
        }
      } catch {
        // Si Gmail falla, igual cargamos las pendientes que ya estaban
        const pendientes = await fetchSugerenciasPendientes();
        setSugerencias(pendientes);
      }
      setLoading(false);
    }
    init();
  }, []);

  const current = sugerencias[idx] ?? null;
  const currentParsed = current ? parsearTextoSugerencia(current.texto_original) : null;
  const currentFecha = currentParsed?.fechaTransferencia ?? current?.fecha ?? null;
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

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Agregar gasto</h1>
        {loading && <span className="text-xs text-muted-foreground animate-pulse">Revisando…</span>}
      </div>

      {/* Banner de sugerencias */}
      {!loading && total > 0 && !terminado && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              {total - idx} {total - idx === 1 ? "pendiente" : "pendientes"}
            </p>
            <span className="text-xs text-muted-foreground">{idx + 1}/{total}</span>
          </div>
          <p className="text-base font-semibold">
            {formatCLP(current!.monto)}
            {currentFecha && (
              <span className="text-sm font-normal text-muted-foreground"> · {formatFecha(currentFecha)}</span>
            )}
          </p>
          {!currentParsed?.origen && !currentParsed?.destino && current!.comercio && (
            <p className="text-sm font-medium">{current!.comercio}</p>
          )}
          {currentParsed?.origen && (
            <p className="text-xs text-muted-foreground">De: <span className="font-medium text-foreground">{currentParsed.origen}</span></p>
          )}
          {currentParsed?.destino && (
            <p className="text-xs text-muted-foreground">Para: <span className="font-medium text-foreground">{currentParsed.destino}</span></p>
          )}
          {currentParsed?.comentario && (
            <p className="text-xs text-muted-foreground italic">&ldquo;{currentParsed.comentario}&rdquo;</p>
          )}
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
          description: currentParsed?.comentario ?? "",
          date: currentFecha ?? todayISO(),
        } : undefined}
      />
    </main>
  );
}
