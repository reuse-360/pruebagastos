"use client";

import { useState, useEffect, useRef } from "react";
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
  const [revisados, setRevisados] = useState(0);
  const [loading, setLoading] = useState(true);

  // Swipe horizontal: la card sigue el dedo mientras se arrastra y, al
  // soltar, o vuelve a su lugar o termina de salir de pantalla y cambia idx.
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const total = sugerencias.length;
  const current = sugerencias[idx] ?? null;
  const atManualSlide = idx >= total;
  const currentParsed = current ? parsearTextoSugerencia(current.texto_original) : null;
  const currentFecha = currentParsed?.fechaTransferencia ?? current?.fecha ?? null;
  // Para push de compras (no transferencias), el comercio capturado sirve como descripción sugerida
  const comercioComoDescripcion =
    !currentParsed?.origen && !currentParsed?.destino && current?.comercio !== "⚠ sin parsear"
      ? current?.comercio ?? ""
      : "";

  function removeFromQueue(id: string) {
    setSugerencias((prev) => prev.filter((s) => s.id !== id));
    setRevisados((n) => n + 1);
  }

  async function handleSaved() {
    if (!current) return;
    await marcarSugerencia(current.id, "guardado");
    removeFromQueue(current.id);
  }

  async function handleIgnorar() {
    if (!current) return;
    await marcarSugerencia(current.id, "ignorado");
    removeFromQueue(current.id);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (animating) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    setDragging(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    if (Math.abs(dy) > Math.abs(dx)) return; // gesto vertical: dejar scrollear
    setDragX(dx);
  }

  function onTouchEnd() {
    if (!touchStartRef.current) return;
    touchStartRef.current = null;
    setDragging(false);

    const width = containerRef.current?.offsetWidth ?? 320;
    const threshold = Math.min(90, width * 0.25);
    const canNext = idx < total; // total = último real; total en sí es el slide de ingreso manual
    const canPrev = idx > 0;

    if (dragX <= -threshold && canNext) {
      setAnimating(true);
      setDragX(-width);
      setTimeout(() => {
        setIdx((i) => i + 1);
        setDragX(0);
        setAnimating(false);
      }, 200);
    } else if (dragX >= threshold && canPrev) {
      setAnimating(true);
      setDragX(width);
      setTimeout(() => {
        setIdx((i) => i - 1);
        setDragX(0);
        setAnimating(false);
      }, 200);
    } else {
      setDragX(0);
    }
  }

  return (
    <main className="container mx-auto max-w-lg px-4 py-8 space-y-4">

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{atManualSlide ? "Nuevo gasto" : "Agregar gasto"}</h1>
        {loading && <span className="text-xs text-muted-foreground animate-pulse">Revisando…</span>}
      </div>

      <div
        ref={containerRef}
        className="touch-pan-y space-y-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 200ms ease",
          opacity: animating ? 0.4 : 1,
        }}
      >
        {/* Banner de sugerencias */}
        {!loading && total > 0 && !atManualSlide && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                {total} {total === 1 ? "pendiente" : "pendientes"}
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

        {!loading && atManualSlide && total === 0 && revisados > 0 && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              ¡Todo al día! Revisaste {revisados} {revisados === 1 ? "gasto" : "gastos"}.
            </p>
          </div>
        )}

        <TransactionForm
          key={current?.id ?? "manual"}
          onSaved={handleSaved}
          onSkip={current ? handleIgnorar : undefined}
          preload={current ? {
            amount: String(current.monto),
            description: currentParsed?.comentario ?? comercioComoDescripcion,
            date: currentFecha ?? todayISO(),
          } : undefined}
        />

        {!loading && total > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {atManualSlide ? "Desliza a la derecha → para volver a los pendientes" : "Desliza ← → para ver otro pendiente"}
          </p>
        )}
      </div>
    </main>
  );
}
