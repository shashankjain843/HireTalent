"use client";

import { getStoredUser } from "@/lib/adminApi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WidgetAdminPage() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    if (user?.role === "superadmin") {
      router.replace("/superadmin/widget-admin");
      return;
    }
    if (user?.role === "admin" || user?.role === "editor" || user?.role === "viewer") {
      router.replace("/company-admin/widget-admin");
    }
  }, [router]);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Widget Admin moved to admin panels</h1>
      <p className="text-sm text-zinc-600">
        Use role-based panel routes for governed behavior access.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/company-admin/widget-admin" className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">
          Go to Tenant Admin
        </Link>
        <Link href="/superadmin/widget-admin" className="rounded bg-indigo-600 px-3 py-2 text-sm text-white">
          Go to Superadmin
        </Link>
      </div>
    </main>
  );
}
