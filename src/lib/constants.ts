export const SPLIT_GON = 0.64;
export const SPLIT_PAU = 0.36;

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function formatCLP(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function pauShare(total: number, is_shared: boolean, name: string): number {
  if (is_shared) return total * SPLIT_PAU;
  if (name === "Pau") return total;
  return 0;
}
