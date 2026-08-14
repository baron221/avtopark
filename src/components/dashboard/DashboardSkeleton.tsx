function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-page ${className}`} />;
}

/**
 * Shown instantly (via loading.tsx) while getOwnerDashboardVM resolves —
 * that's 10+ parallel queries against a high-latency DB region (see
 * dashboard.ts's own comments on why it fetches flat instead of nested),
 * so without this the report pages sat on a blank screen for a beat on
 * every navigation. Shape-matches FleetDashboard's embedded layout closely
 * enough that swapping in the real content doesn't visibly jump.
 */
export function DashboardSkeleton() {
  return (
    <div className="max-w-[1180px] mx-auto w-full p-4 sm:p-7 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Block className="h-4 w-48" />
        <Block className="h-9 w-64" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
            <Block className="h-3 w-24" />
            <Block className="h-7 w-32" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
          <Block className="h-4 w-56" />
          <Block className="h-[180px] w-full" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-3">
          <Block className="h-4 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Block key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-3">
            <Block className="h-4 w-40" />
            <div className="grid grid-cols-2 gap-3">
              <Block className="h-16" />
              <Block className="h-16" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5">
          <Block className="h-4 w-48" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 border-t border-row-divider">
            <Block className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
