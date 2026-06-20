"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

const links = [
  { href: "/", label: "Agregar" },
  { href: "/resumen", label: "Resumen" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/anual", label: "Anual" },
  ...(process.env.NEXT_PUBLIC_SHOW_BASE === "true"
    ? [{ href: "/base", label: "Base" }]
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
    <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="container mx-auto max-w-4xl px-4 flex items-center h-13 gap-1">
        <span className="text-sm font-semibold text-primary mr-3 tracking-tight select-none">
          gastos
        </span>
        <div className="flex gap-0.5 flex-1">
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
        <ThemeToggle />
      </div>
    </nav>
  );
}
