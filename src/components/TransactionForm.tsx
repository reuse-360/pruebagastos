"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { ExpenseCategory, HouseholdMember } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SPLIT_GON = 0.64;
const SPLIT_PAULINA = 0.36;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatCLP(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

const nativeSelectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function TransactionForm({ onSaved }: { onSaved?: () => void }) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [paidById, setPaidById] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    Promise.all([
      supabase
        .from("expense_categories")
        .select("*")
        .eq("active", true)
        .order("is_shared", { ascending: false })
        .order("name"),
      supabase
        .from("household_members")
        .select("*")
        .eq("active", true)
        .order("name"),
    ]).then(([{ data: cats }, { data: mems }]) => {
      if (cats) setCategories(cats as ExpenseCategory[]);
      if (mems) setMembers(mems as HouseholdMember[]);
    });
  }, []);

  const selectedCategory = categories.find((c) => c.id === Number(categoryId));
  const numericAmount = parseFloat(amount.replace(/\./g, "").replace(",", ".")) || 0;
  const isShared = selectedCategory?.is_shared ?? false;

  const sharedCategories = categories.filter((c) => c.is_shared);
  const personalCategories = categories.filter((c) => !c.is_shared);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || !paidById || !amount) return;

    setError(null);
    setSubmitting(true);

    const { error: err } = await supabase.from("transactions").insert([{
      amount: numericAmount,
      transaction_date: date,
      description: description.trim() || null,
      category_id: Number(categoryId),
      paid_by_member_id: Number(paidById),
    }]);

    setSubmitting(false);

    if (err) {
      setError(err.message);
      return;
    }

    setSaved(true);
    setAmount("");
    setCategoryId("");
    setDate(todayISO());
    setPaidById("");
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
            <Label htmlFor="categoryId">Categoría</Label>
            <select
              id="categoryId"
              className={nativeSelectClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Selecciona una categoría</option>
              <optgroup label="Compartidas">
                {sharedCategories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Personales">
                {personalCategories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
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
            <Label htmlFor="paidById">¿Quién pagó?</Label>
            <select
              id="paidById"
              className={nativeSelectClass}
              value={paidById}
              onChange={(e) => setPaidById(e.target.value)}
              required
            >
              <option value="">Selecciona quién pagó</option>
              {members.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name}
                </option>
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

          {/* Split automático */}
          {isShared && numericAmount > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
              <p className="font-medium text-muted-foreground">Split compartido</p>
              <div className="flex justify-between">
                <span>Gon (64%)</span>
                <span className="font-semibold">{formatCLP(numericAmount * SPLIT_GON)}</span>
              </div>
              <div className="flex justify-between">
                <span>Paulina (36%)</span>
                <span className="font-semibold">{formatCLP(numericAmount * SPLIT_PAULINA)}</span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {saved && (
            <p className="text-sm text-green-600">Gasto guardado correctamente.</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar gasto"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
