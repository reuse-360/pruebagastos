"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Sun, Moon, Plus, Receipt, BarChart2, CalendarDays, Database } from "lucide-react";

const links = [
  { href: "/", label: "Agregar", icon: Plus },
  { href: "/resumen", label: "Resumen", icon: Receipt },
  { href: "/dashboard", label: "Dashboard", icon: BarChart2 },
  { href: "/anual", label: "Anual", icon: CalendarDays },
  ...(process.env.NEXT_PUBLIC_SHOW_BASE === "true"
    ? [{ href: "/base", label: "Base", icon: Database }]
    : []),
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label="Cambiar tema"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto max-w-4xl px-4 flex items-center h-13 gap-1">
          <span className="text-sm font-semibold text-primary mr-3 tracking-tight select-none">
            gastos
          </span>

          {/* Desktop links */}
          <div className="hidden sm:flex gap-0.5 flex-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex-1 sm:hidden" />
          <ThemeToggle />
        </div>
      </nav>

      {/* ── Bottom tab bar — mobile only ────────────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm">
        <div className="flex items-stretch h-16">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

    </>
  );
}
