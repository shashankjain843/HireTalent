"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { candidateMe } from "@/lib/candidateApi";

const STORAGE_KEY = "candidate_portal_token";

export default function CandidateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [me, setMe] = useState<{ name: string; title: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      return;
    }
    void candidateMe(token)
      .then((res) => setMe({ name: res.name, title: res.title }))
      .catch(() => {
        setMe(null);
      });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link
            href="/candidate/opportunities"
            className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            Chats
          </Link>
          {me ? (
            <div className="text-right">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {me.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{me.title}</p>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}
