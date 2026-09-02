"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getStoredUser, logout } from "../../lib/adminApi";

const NAV_ITEMS = [
  { href: "/company-admin", label: "Dashboard", icon: "◫" },
  { href: "/company-admin/actions", label: "Actions", icon: "⚡" },
  { href: "/company-admin/playbooks", label: "Playbooks", icon: "⌘" },
  { href: "/company-admin/categories", label: "Categories", icon: "▦" },
  { href: "/company-admin/knowledge", label: "Knowledge Base", icon: "◉" },
  { href: "/company-admin/chunking-inspector", label: "Chunking Inspector", icon: "◨" },
  { href: "/company-admin/employees", label: "Employees", icon: "◌" },
  { href: "/company-admin/skills", label: "Skills Config", icon: "✦" },
  { href: "/company-admin/widget-admin", label: "Widget Admin", icon: "⌁" },
  { href: "/company-admin/how-to-use", label: "How To Use", icon: "⋯" },
  { href: "/company-admin/audit", label: "Audit Logs", icon: "☰" },
];

export default function CompanyAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  useEffect(() => {
    setIsMounted(true);
    const stored = getStoredUser();
    setUser(stored);
    if (!stored || !["admin", "editor", "viewer", "superadmin"].includes(stored.role)) {
      if (pathname !== "/company-admin/login") router.push("/company-admin/login");
    }
  }, [router, pathname]);

  const commandItems = useMemo(
    () => [
      { id: "go-dashboard", label: "Go to Dashboard", action: () => router.push("/company-admin") },
      {
        id: "go-knowledge",
        label: "Go to Knowledge Base",
        action: () => router.push("/company-admin/knowledge"),
      },
      {
        id: "go-actions",
        label: "Go to Actions",
        action: () => router.push("/company-admin/actions"),
      },
      {
        id: "go-playbooks",
        label: "Go to Playbooks",
        action: () => router.push("/company-admin/playbooks"),
      },
      {
        id: "go-chunking-inspector",
        label: "Go to Chunking Inspector",
        action: () => router.push("/company-admin/chunking-inspector"),
      },
      {
        id: "go-employees",
        label: "Go to Employees",
        action: () => router.push("/company-admin/employees"),
      },
      {
        id: "go-skills",
        label: "Go to Skills Config",
        action: () => router.push("/company-admin/skills"),
      },
      {
        id: "go-widget-admin",
        label: "Go to Widget Admin",
        action: () => router.push("/company-admin/widget-admin"),
      },
      {
        id: "go-how-to-use",
        label: "Go to How To Use",
        action: () => router.push("/company-admin/how-to-use"),
      },
      {
        id: "toggle-sidebar",
        label: isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar",
        action: () => setIsSidebarCollapsed((prev) => !prev),
      },
      {
        id: "open-qa-sandbox",
        label: "Open QA Sandbox (coming soon)",
        action: () => router.push("/company-admin/knowledge"),
      },
    ],
    [router, isSidebarCollapsed],
  );

  const filteredCommandItems = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return commandItems;
    return commandItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [commandItems, paletteQuery]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const triggerPalette = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (triggerPalette) {
        event.preventDefault();
        setIsPaletteOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setIsPaletteOpen(false);
        setPaletteQuery("");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  
  function closePalette() {
    setIsPaletteOpen(false);
    setPaletteQuery("");
  }

  if (pathname === "/company-admin/login") return <>{children}</>;
  if (!isMounted) return <div className="admin-shell"><div className="p-8 text-slate-400 text-sm">Loading workspace...</div></div>;
  if (!user) return null;

  return (
    <div className="admin-shell">
      <div
        className="admin-frame"
        style={{ gridTemplateColumns: isSidebarCollapsed ? "52px 1fr" : "200px 1fr" }}
      >
        <aside className="admin-sidebar flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-800">
            <div className="flex items-center justify-between gap-1.5">
              {!isSidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <h1 className="text-xs font-semibold tracking-tight text-white truncate">
                    Company Console
                  </h1>
                  <p className="text-[10.5px] text-gray-400 truncate leading-none mt-0.5">{user.email}</p>
                </div>
              )}
              <button
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                className="h-6 w-6 rounded border border-gray-700 text-[11px] text-gray-300 hover:text-white hover:bg-gray-800 flex items-center justify-center shrink-0"
                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isSidebarCollapsed ? "»" : "«"}
              </button>
            </div>
          </div>
          <nav className="flex-1 py-2.5 space-y-1 px-2 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/company-admin"
                  ? pathname === "/company-admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`block px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors border ${
                    active
                      ? "bg-white text-gray-950 border-white shadow-[inset_2.5px_0_0_0_#4f46e5]"
                      : "text-gray-300 border-transparent hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-center text-xs">{item.icon}</span>
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="p-2 border-t border-gray-800 space-y-1">
            {!isSidebarCollapsed && (
              <div className="px-2 py-1 rounded bg-gray-900/80 border border-gray-800/80 mb-1">
                <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>AI Engine Online</span>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsPaletteOpen(true)}
              className="w-full text-left px-2.5 py-1 text-[11.5px] text-gray-300 rounded hover:bg-gray-800 transition-colors flex items-center justify-between"
            >
              <span>{isSidebarCollapsed ? "⌘K" : "Command Palette"}</span>
              {!isSidebarCollapsed && <kbd className="text-[10px] text-gray-500 bg-gray-800 px-1 rounded">⌘K</kbd>}
            </button>
            <button
              onClick={() => {
                logout();
                router.push("/company-admin/login");
              }}
              className="w-full text-left px-2.5 py-1 text-[11.5px] text-gray-400 hover:text-rose-300 hover:bg-rose-950/30 rounded transition-colors"
            >
              {isSidebarCollapsed ? "↩" : "Sign out"}
            </button>
          </div>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <div className="text-sm font-medium text-gray-700">
              Tenant Administration
            </div>
            <div className="text-xs text-gray-500">
              Role:{" "}
              <span className="font-semibold text-gray-700 uppercase">{user.role}</span>
            </div>
          </header>
          <main className="admin-content">{children}</main>
        </div>
      </div>
      {isPaletteOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 px-4 py-16"
          onClick={closePalette}
        >
          <div
            className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3">
              <input
                autoFocus
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="Search commands..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredCommandItems.length === 0 && (
                <p className="px-2 py-6 text-sm text-slate-500 text-center">No commands found.</p>
              )}
              {filteredCommandItems.map((item) => (
                <button
                  key={item.id}
                  className="w-full text-left rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    item.action();
                    closePalette();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
