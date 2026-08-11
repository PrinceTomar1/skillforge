import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

export function AppLayout({ children, wide = false, hideFooter = false }: { children: ReactNode; wide?: boolean; hideFooter?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <main className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 lg:px-8 ${wide ? "max-w-[1600px]" : "max-w-7xl"}`}>{children}</main>
      {!hideFooter && (
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
          SkillForge — a solo portfolio project, not a real company.
        </footer>
      )}
    </div>
  );
}
