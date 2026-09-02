"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getStoredUser, logout } from "../../lib/adminApi";

const NAV_ITEMS = [
  { href: "/superadmin", label: "Dashboard" },
  { href: "/superadmin/tenants", label: "Tenants" },
  { href: "/superadmin/users", label: "Users" },
  { href: "/superadmin/skills", label: "Skill Templates" },
  { href: "/superadmin/policies", label: "AI Governance" },
  { href: "/superadmin/defaults", label: "Defaults" },
  { href: "/superadmin/widget-admin", label: "Widget Admin" },
  { href: "/superadmin/how-to-use", label: "How To Use" },
  { href: "/superadmin/audit", label: "Audit Logs" },
];

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    const stored = getStoredUser();
    setUser(stored);
    if (!stored || stored.role !== "superadmin") {
      if (pathname !== "/superadmin/login") router.push("/superadmin/login");
    }
  }, [router, pathname]);

  if (pathname === "/superadmin/login") return <>{children}</>;
  if (!isMounted) return <div className="admin-shell"><div className="p-8 text-slate-400 text-sm">Loading console...</div></div>;
  if (!user) return null;

  return (
    <div className="admin-shell">
      <div className="admin-frame">
        <aside className="admin-sidebar flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-800">
            <h1 className="text-xs font-semibold tracking-tight text-white truncate">
              Superadmin Console
            </h1>
            <p className="text-[10.5px] text-gray-400 truncate leading-none mt-0.5">{user.email}</p>
          </div>
          <nav className="flex-1 py-2.5 space-y-1 px-2 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/superadmin"
                  ? pathname === "/superadmin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors border ${
                    active
                      ? "bg-white text-gray-950 border-white shadow-[inset_2.5px_0_0_0_#4f46e5]"
                      : "text-gray-300 border-transparent hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-2 border-t border-gray-800 space-y-1">
            <div className="px-2 py-1 rounded bg-gray-900/80 border border-gray-800/80 mb-1">
              <div className="flex items-center gap-1.5 text-[10.5px] text-indigo-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                <span>Master Admin</span>
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                router.push("/superadmin/login");
              }}
              className="w-full text-left px-2.5 py-1 text-[11.5px] text-gray-400 hover:text-rose-300 hover:bg-rose-950/30 rounded transition-colors"
            >
              Sign out
            </button>
          </div>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <div className="text-sm font-medium text-gray-700">
              Platform Administration
            </div>
            <div className="text-xs text-gray-500">
              Role: <span className="font-semibold text-gray-700">Superadmin</span>
            </div>
          </header>
          <main className="admin-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
