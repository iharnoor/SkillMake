import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  return (
    <div className="max-w-md mx-auto px-6 pt-24 pb-20">
      <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-3">
        Curator
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Sign in to vet skills.</h1>
      <p className="text-[color:var(--fg-muted)] text-sm mb-6 leading-relaxed">
        Every published skill is personally reviewed before it joins the marketplace. Enter your
        admin token to open the queue.
      </p>
      {reason === "unconfigured" && (
        <div className="card p-4 mb-5 border-[color:var(--warn)]/40">
          <p className="text-sm text-[color:var(--fg)]">
            <span className="mono text-[11px] uppercase tracking-wider text-[color:var(--warn)] mr-2">
              Setup
            </span>
            <code className="mono text-xs">ADMIN_TOKEN</code> is not set. Run{" "}
            <code className="mono text-xs">wrangler secret put ADMIN_TOKEN</code> (or add it to{" "}
            <code className="mono text-xs">.env.local</code> for dev) and reload.
          </p>
        </div>
      )}
      <LoginForm nextPath={next ?? "/admin"} />
    </div>
  );
}
