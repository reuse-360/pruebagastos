export const SPLIT_GON = 0.64;
export const SPLIT_PAU = 0.36;

export const SPLIT_CAMBIO_FECHA = "2026-11-01";

export function getSplit(fecha: string) {
  // fecha is "YYYY-MM-DD" (or an ISO string starting with that)
  return fecha.slice(0, 10) >= SPLIT_CAMBIO_FECHA
    ? { gon: 0.67, pau: 0.33 }
    : { gon: SPLIT_GON, pau: SPLIT_PAU };
}

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

