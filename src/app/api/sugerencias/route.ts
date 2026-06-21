import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Extrae comercio, monto y fecha del texto de push de Santander
// Formato: "transacción por $X.XXX se realizó un pago con tu Tarjeta de Crédito ****XXXX en/em COMERCIO DD/MM/YYYY HH:MM:SS"
// También soporta montos USD: "transacción por USD X.XX ..."
function parsearNotificacion(texto: string): { comercio: string; monto: number; fecha?: string; usd?: boolean } | null {
  // Detectar si es USD
  const esUsd = /transacci[oó]n por\s+USD/i.test(texto);

  // Monto: CLP "por $X.XXX" o USD "por USD X.XX"
  const montoMatch = texto.match(/transacci[oó]n por\s+(?:USD\s*)?\$?\s*([\d.,]+)/i)
    ?? texto.match(/por\s+\$?([\d.,]+)/i);
  if (!montoMatch) return null;

  let monto: number;
  if (esUsd) {
    // USD usa punto como decimal: "25.00" → 25
    monto = Math.round(parseFloat(montoMatch[1].replace(/,/g, "")));
  } else {
    // CLP usa punto como miles: "15.990" → 15990
    monto = parseInt(montoMatch[1].replace(/\./g, "").replace(",", ""));
  }
  if (isNaN(monto) || monto === 0) return null;

  // Comercio: después de "en " o "em " antes de la fecha DD/MM/YYYY
  const comercioMatch = texto.match(/\b(?:en|em)\s+(.+?)\s+\d{2}\/\d{2}\/\d{4}/i);
  const comercio = (comercioMatch?.[1]?.trim() ?? "Tarjeta") + (esUsd ? " (USD)" : "");

  // Fecha
  const fechaMatch = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const fecha = fechaMatch ? `${fechaMatch[3]}-${fechaMatch[2].padStart(2,"0")}-${fechaMatch[1].padStart(2,"0")}` : undefined;

  return { comercio, monto, fecha, usd: esUsd };
}

export async function POST(request: NextRequest) {
  // Protección básica: mismo token que usa la app
  const auth = request.headers.get("x-api-key");
  if (auth !== process.env.AUTH_PASSWORD) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const texto: string = body.texto ?? "";

  if (!texto) {
    return NextResponse.json({ error: "Falta el campo texto" }, { status: 400 });
  }

  const parsed = parsearNotificacion(texto);
  if (!parsed) {
    return NextResponse.json({ error: "No se pudo parsear la notificación", texto }, { status: 422 });
  }

  const { error } = await supabase.from("sugerencias").insert({
    comercio: parsed.comercio,
    monto: parsed.monto,
    texto_original: texto,
    ...(parsed.fecha ? { fecha: parsed.fecha } : {}),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, comercio: parsed.comercio, monto: parsed.monto, fecha: parsed.fecha });
}
