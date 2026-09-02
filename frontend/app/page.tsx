import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Clock,
  Filter,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[color:var(--background)]/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="group inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-sm">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Talent Finder
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-neutral-600 dark:text-neutral-300 md:flex">
            <a href="#features" className="hover:text-neutral-900 dark:hover:text-white">
              Features
            </a>
            <a href="#how" className="hover:text-neutral-900 dark:hover:text-white">
              How it works
            </a>
            <a href="#security" className="hover:text-neutral-900 dark:hover:text-white">
              Security
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/company-admin/login"
              className="hidden rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:text-neutral-100 dark:hover:bg-white/10 sm:inline-flex"
            >
              Company login
            </Link>
            <Link
              href="/candidate"
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Try the chat demo
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-[420px] max-w-5xl rounded-[48px] bg-gradient-to-r from-indigo-500/20 via-fuchsia-500/10 to-emerald-500/15 blur-3xl"
          aria-hidden
        />
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-14 md:grid-cols-2 md:items-center md:pb-24 md:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs font-semibold text-neutral-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-neutral-200">
              <BadgeCheck className="h-4 w-4" aria-hidden />
              AI-powered candidate matching
            </p>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white md:text-5xl">
              Hire faster with a conversational hiring assistant.
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-neutral-600 dark:text-neutral-300 md:text-lg">
              Turn role requirements into a guided chat that screens, shortlists, and explains the “why” behind
              every recommendation—so your team spends time on the right candidates.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/candidate"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
              >
                Start the demo
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/company-admin/how-to-use"
                className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                See how teams use it
              </Link>
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: Clock, title: "Minutes to shortlist", desc: "Cut screening overhead." },
                { icon: Target, title: "Match by skills", desc: "Structured criteria, clear scoring." },
                { icon: MessagesSquare, title: "Chat-first UX", desc: "Typeform-style flow." },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                >
                  <Icon className="h-5 w-5 text-neutral-900 dark:text-white" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-neutral-900 dark:text-white">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-black/5 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 md:p-5">
              <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-neutral-950">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">Role: Senior Frontend Engineer</p>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Live demo
                  </span>
                </div>
                <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                  “Ask me questions like a recruiter. I’ll shortlist based on skills, impact, and fit.”
                </p>

                <div className="mt-5 space-y-3">
                  <div className="flex gap-3">
                    <div className="mt-1 h-8 w-8 shrink-0 rounded-xl bg-indigo-500/15 text-indigo-700 grid place-items-center dark:text-indigo-300">
                      <Users className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-800 dark:bg-white/10 dark:text-neutral-100">
                      Show me candidates with React + performance optimization experience.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-1 h-8 w-8 shrink-0 rounded-xl bg-fuchsia-500/15 text-fuchsia-700 grid place-items-center dark:text-fuchsia-300">
                      <Filter className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white dark:bg-white dark:text-neutral-900">
                      Shortlisting 5 candidates. Explaining matches by skills, evidence, and gaps.
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { name: "A. Sharma", score: "92", note: "React + Core Web Vitals, led perf audits." },
                      { name: "M. Chen", score: "89", note: "Design systems, SSR/edge rendering." },
                      { name: "R. Khan", score: "86", note: "State mgmt at scale, DX improvements." },
                      { name: "S. Patel", score: "84", note: "Accessibility, testing, maintainability." },
                    ].map((c) => (
                      <div
                        key={c.name}
                        className="rounded-2xl border border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-neutral-900 dark:text-white">{c.name}</p>
                          <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                            {c.score}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">{c.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Tip: Ask “why” to see evidence & gaps.
                  </p>
                  <Link
                    href="/candidate"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  >
                    Open demo
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-5 pb-16">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              icon: Building2,
              title: "Built for hiring teams",
              desc: "Role-based flows for company admins, candidates, and superadmins—without a messy UX.",
            },
            {
              icon: Target,
              title: "Explainable matching",
              desc: "See which skills and signals drove a recommendation, with clear strengths and gaps.",
            },
            {
              icon: Clock,
              title: "Faster throughput",
              desc: "Standardize screening, reduce back-and-forth, and get to interviews with confidence.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-3xl border border-black/5 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
            >
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto w-full max-w-6xl px-5 pb-16">
        <div className="rounded-3xl border border-black/5 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                How it works
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
                From role to shortlist in three steps
              </h2>
            </div>
            <Link
              href="/company-admin/how-to-use"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:underline dark:text-white"
            >
              View the guide <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Define the role",
                desc: "Skills, must-haves, nice-to-haves, and evidence you care about.",
              },
              {
                step: "02",
                title: "Chat-driven screening",
                desc: "Candidates answer naturally while the system keeps structure behind the scenes.",
              },
              {
                step: "03",
                title: "Shortlist with rationale",
                desc: "Get ranked candidates with a transparent explanation of why they match.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-neutral-950"
              >
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Step {s.step}</p>
                <p className="mt-2 text-base font-semibold text-neutral-900 dark:text-white">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="mx-auto w-full max-w-6xl px-5 pb-16">
        <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
          <div className="rounded-3xl border border-black/5 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 md:p-8">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
                  Security-minded by default
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  Built to support enterprise workflows and audits.
                </p>
              </div>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-neutral-700 dark:text-neutral-200">
              {[
                "Role-based access for admin and candidate experiences",
                "Audit-friendly flows and clear operational ownership",
                "Consistent UI patterns for reduced operator error",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-900 dark:bg-white" />
                  <span className="leading-relaxed">{x}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-black/5 bg-neutral-900 p-6 shadow-sm dark:bg-white md:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-white dark:text-neutral-900">
              Ready to see it in action?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80 dark:text-neutral-700">
              Jump into the candidate flow and experience the chat-driven screening from end to end.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/candidate"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-100 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
              >
                Start the demo
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/company-admin/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-white/10 dark:border-black/10 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-50"
              >
                Company login
              </Link>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { icon: BadgeCheck, title: "Clear matches", desc: "Explainable, auditable rationale." },
                { icon: Clock, title: "Less busywork", desc: "Automate first-pass screening." },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 dark:border-black/10 dark:bg-neutral-100"
                >
                  <Icon className="h-5 w-5 text-white dark:text-neutral-900" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-white dark:text-neutral-900">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/75 dark:text-neutral-700">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/5 py-10 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            © {new Date().getFullYear()} Talent Finder. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-neutral-700 dark:text-neutral-200">
            <Link href="/how-to-use" className="hover:underline">
              How to use
            </Link>
            <Link href="/shortlisted" className="hover:underline">
              Shortlisted
            </Link>
            <Link href="/superadmin/login" className="hover:underline">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
