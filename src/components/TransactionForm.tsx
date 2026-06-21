"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCLP, SPLIT_GON, SPLIT_PAU } from "@/lib/constants";

type QuienPago = "gon" | "pau" | "ambos";

const QUIEN_OPTIONS: { value: QuienPago; label: string }[] = [
  { value: "gon", label: "Gon" },
  { value: "pau", label: "Pau" },
  { value: "ambos", label: "Ambos (compartido)" },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const nativeSelectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface TransactionFormProps {
  onSaved?: () => void;
  onSkip?: () => void;
  preload?: {
    amount: string;
    description: string;
    date: string;
  };
}

export function TransactionForm({ onSaved, onSkip, preload }: TransactionFormProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [amount, setAmount] = useState(preload?.amount ?? "");
  const [categoria, setCategoria] = useState("");
  const [date, setDate] = useState(preload?.date ?? todayISO());
  const [quienPago, setQuienPago] = useState<QuienPago | "">("");
  const [description, setDescription] = useState(preload?.description ?? "");

  // sincroniza si cambia el preload (siguiente sugerencia)
  useEffect(() => {
    if (preload) {
      setAmount(preload.amount);
      setDescription(preload.description);
      setDate(preload.date);
      setCategoria("");
      setQuienPago("");
    }
  }, [preload?.amount, preload?.description, preload?.date]);

  useEffect(() => {
    supabase
      .from("expense_categories")
      .select("name")
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setCategories(data.map((c: { name: string }) => c.name));
        setLoadingData(false);
      });
  }, []);

  const numericAmount = parseFloat(amount.replace(/\./g, "").replace(",", ".")) || 0;
  const isAmbos = quienPago === "ambos";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoria || !quienPago || !amount) return;

    setError(null);
    setSubmitting(true);

    const base = {
      fecha: date,
      quien_pago: quienPago,
      categoria,
      descripcion: description.trim() || null,
      valor_original: numericAmount,
    };

    const errs: string[] = [];

    if (quienPago === "gon" || quienPago === "ambos") {
      const valor_gon = quienPago === "ambos" ? numericAmount * SPLIT_GON : numericAmount;
      const { error: err } = await supabase.from("gastos_gon").insert([{ ...base, valor_gon }]);
      if (err) errs.push(err.message);
    }

    if (quienPago === "pau" || quienPago === "ambos") {
      const valor_pau = quienPago === "ambos" ? numericAmount * SPLIT_PAU : numericAmount;
      const { error: err } = await supabase.from("gastos_pau").insert([{ ...base, valor_pau }]);
      if (err) errs.push(err.message);
    }

    setSubmitting(false);

    if (errs.length > 0) {
      setError(errs.join(" / "));
      return;
    }

    setSaved(true);
    setAmount("");
    setCategoria("");
    setDate(todayISO());
    setQuienPago("");
    setDescription("");
    setTimeout(() => setSaved(false), 3000);
    onSaved?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo gasto</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Monto */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Monto</Label>
            <Input
              id="amount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {/* Categoría */}
          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoría</Label>
            <select
              id="categoria"
              className={nativeSelectClass}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              required
              disabled={loadingData}
            >
              <option value="">
                {loadingData ? "Cargando…" : "Selecciona una categoría"}
              </option>
              {categories.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className="space-y-1.5">
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Quién pagó */}
          <div className="space-y-1.5">
            <Label htmlFor="quienPago">¿Quién pagó?</Label>
            <select
              id="quienPago"
              className={nativeSelectClass}
              value={quienPago}
              onChange={(e) => setQuienPago(e.target.value as QuienPago | "")}
              required
            >
              <option value="">Selecciona quién pagó</option>
              {QUIEN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Input
              id="description"
              type="text"
              placeholder="Ej: Supermercado Jumbo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Preview split cuando es compartido */}
          {isAmbos && numericAmount > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
              <p className="font-medium text-muted-foreground">Split compartido</p>
              <div className="flex justify-between">
                <span>Gon (64%)</span>
                <span className="font-semibold">{formatCLP(numericAmount * SPLIT_GON)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pau (36%)</span>
                <span className="font-semibold">{formatCLP(numericAmount * SPLIT_PAU)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-600">Gasto guardado correctamente.</p>}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={submitting || !quienPago || !categoria || !amount}>
              {submitting ? "Guardando…" : "Guardar gasto"}
            </Button>
            {onSkip && (
              <Button type="button" variant="outline" onClick={onSkip} disabled={submitting}>
                Ignorar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
