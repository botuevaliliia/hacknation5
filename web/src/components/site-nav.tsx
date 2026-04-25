import Link from "next/link";

export function SiteNav() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="text-sm font-medium tracking-tight text-zinc-100">
          AgentValue
        </Link>
        <nav className="flex items-center gap-5 text-xs text-zinc-500">
          <Link href="/marketplace" className="hover:text-zinc-300">
            Marketplace
          </Link>
          <Link href="/marketplace/new" className="hover:text-zinc-300">
            List a service
          </Link>
          <Link href="/observability" className="hover:text-zinc-300">
            Observability
          </Link>
        </nav>
      </div>
    </header>
  );
}
