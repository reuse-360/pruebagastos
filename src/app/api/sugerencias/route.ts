import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Extrae comercio y monto del texto de notificación del banco
// Formato: "...en {COMERCIO} por {MONTO}"
function parsearNotificacion(texto: string): { comercio: string; monto: number } | null {
  const match = texto.match(/en\s+(.+?)\s+por\s+\$?([\d.,]+)/i);
  if (!match) return null;

  const comercio = match[1].trim();
  const montoStr = match[2].replace(/\./g, "").replace(",", ".");
  const monto = parseFloat(montoStr);

  if (!comercio || isNaN(monto)) return null;
  return { comercio, monto };
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
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, comercio: parsed.comercio, monto: parsed.monto });
}
