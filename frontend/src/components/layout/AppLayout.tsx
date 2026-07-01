import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

export function AppLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className={`mx-auto px-4 py-8 sm:px-6 lg:px-8 ${wide ? "max-w-[1600px]" : "max-w-7xl"}`}>{children}</main>
    </div>
  );
}
