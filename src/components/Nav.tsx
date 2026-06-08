"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Agregar" },
  { href: "/resumen", label: "Resumen" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-background sticky top-0 z-40">
      <div className="container mx-auto max-w-lg px-4 flex gap-1 h-12 items-center">
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
    </nav>
  );
}
