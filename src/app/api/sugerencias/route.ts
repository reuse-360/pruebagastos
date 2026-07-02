import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getUsdToCLP(): Promise<number> {
  // Dólar observado del Banco Central de Chile (misma base que usa Santander)
  try {
    const res = await fetch("https://mindicador.cl/api/dolar");
    const data = await res.json() as { serie?: { valor: number }[] };
    const valor = data.serie?.[0]?.valor;
    if (valor && valor > 0) return valor;
  } catch { /* continúa */ }
  // Fallback: open.er-api
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json() as { rates?: { CLP?: number } };
    if (data.rates?.CLP) return data.rates.CLP;
  } catch { /* continúa */ }
  return 950;
}

// Formato CLP: "Transacción por $ 10.000. se realizó una compra/pago con tu Tarjeta ****XXXX en COMERCIO, el DD-MM-YYYY a las HH:MM:SS"
// Formato USD: "Transacción por USD 10,99. se realizó un pago con tu Tarjeta ****XXXX en COMERCIO el DD-MM-YYYY a las HH:MM:SS"
function parsearNotificacion(textoRaw: string): { comercio: string; montoUsd: number | null; montoCLP: number; fecha?: string } | null {
  // Normalizar Unicode (ó precompuesto vs descompuesto) y colapsar saltos de línea
  const texto = textoRaw.normalize("NFC").replace(/[\r\n]+/g, " ");

  const esUsd = /USD/i.test(texto) && /por\s+USD/i.test(texto);

  // Monto: busca "por $ X.XXX" o "por USD X,XX" — con \s* robusto en todos los gaps
  const montoMatch =
    texto.match(/por\s+(?:USD\s*)?\$\s*([\d.,]+)/i) ??
    texto.match(/por\s+USD\s*([\d.,]+)/i) ??
    texto.match(/\$\s*([\d.]{3,})/);  // fallback: primer $ seguido de al menos 3 chars numéricos
  if (!montoMatch) return null;

  let montoUsd: number | null = null;
  let montoCLP: number;

  if (esUsd) {
    // "10,99" → comma es separador decimal → "10.99" → 10.99
    montoUsd = parseFloat(montoMatch[1].replace(/\./g, "").replace(",", "."));
    if (isNaN(montoUsd) || montoUsd === 0) return null;
    montoCLP = 0; // se completa después con el tipo de cambio
  } else {
    // "10.000" → punto es separador de miles → 10000
    montoCLP = parseInt(montoMatch[1].replace(/\./g, "").replace(",", ""));
    if (isNaN(montoCLP) || montoCLP === 0) return null;
  }

  // Comercio: entre "en" y la fecha, con posible ", el" antes de la fecha
  const comercioMatch = texto.match(/\b(?:en|em)\s+(.+?),?\s*(?:el\s+)?\d{2}[-\/]\d{2}[-\/]\d{4}/i);
  const comercio = comercioMatch?.[1]?.trim() ?? "Tarjeta";

  // Fecha: DD/MM/YYYY o DD-MM-YYYY → YYYY-MM-DD
  const fechaMatch = texto.match(/(\d{2})[-\/](\d{2})[-\/](\d{4})/);
  const fecha = fechaMatch
    ? `${fechaMatch[3]}-${fechaMatch[2].padStart(2, "0")}-${fechaMatch[1].padStart(2, "0")}`
    : undefined;

  return { comercio, montoUsd, montoCLP, fecha };
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("x-api-key") ?? new URL(request.url).searchParams.get("key");
  if (auth !== process.env.AUTH_PASSWORD) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const texto: string = body.texto ?? "";
  if (!texto) return NextResponse.json({ error: "Falta el campo texto" }, { status: 400 });

  const parsed = parsearNotificacion(texto);
  if (!parsed) {
    // Guardar igualmente para poder revisar el formato y arreglar el parser
    await supabase.from("sugerencias").insert({
      comercio: "⚠ sin parsear",
      monto: 0,
      texto_original: texto,
    });
    return NextResponse.json({ error: "No se pudo parsear la notificación", texto }, { status: 422 });
  }

  let montoCLP = parsed.montoCLP;
  let tipoCambio: number | null = null;

  if (parsed.montoUsd !== null) {
    const baseRate = await getUsdToCLP();
    tipoCambio = Math.round(baseRate * 1.035); // spread bancario Santander ~3.5%
    montoCLP = Math.round(parsed.montoUsd * tipoCambio);
  }

  const comercioFinal = parsed.montoUsd !== null
    ? `${parsed.comercio} (USD ${parsed.montoUsd.toFixed(2)})`
    : parsed.comercio;

  const { error } = await supabase.from("sugerencias").insert({
    comercio: comercioFinal,
    monto: montoCLP,
    texto_original: texto,
    ...(parsed.fecha ? { fecha: parsed.fecha } : {}),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    comercio: comercioFinal,
    monto: montoCLP,
    fecha: parsed.fecha,
    ...(parsed.montoUsd !== null ? { usd: parsed.montoUsd, tipoCambio } : {}),
  });
}
