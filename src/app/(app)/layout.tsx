import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logout } from "./actions";
import { NavLinks } from "@/components/NavLinks";
import { MobileNav } from "@/components/MobileNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ── Desktop sidebar ──────────────────────────────── */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        {/* Logo + user */}
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 shadow-sm">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight">ISP Billing</div>
              <div className="text-xs text-slate-500 leading-tight mt-0.5">{session.name}</div>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks />
        </div>

        {/* Logout */}
        <div className="border-t border-slate-100 p-3">
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile top bar + drawer ───────────────────────── */}
      <MobileNav sessionName={session.name} logoutAction={logout} />

      {/* ── Page content ─────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
