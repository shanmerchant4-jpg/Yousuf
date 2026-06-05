export default function CustomersLoading() {
  return (
    <div className="space-y-5" aria-label="Loading customers" aria-busy="true">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-9 w-32 rounded-lg" />
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1.5">
          <div className="skeleton h-3 w-12" />
          <div className="skeleton h-9 w-full rounded-lg" />
        </div>
        <div className="w-36 space-y-1.5">
          <div className="skeleton h-3 w-10" />
          <div className="skeleton h-9 w-full rounded-lg" />
        </div>
        <div className="w-32 space-y-1.5">
          <div className="skeleton h-3 w-10" />
          <div className="skeleton h-9 w-full rounded-lg" />
        </div>
        <div className="skeleton h-9 w-20 rounded-lg" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {/* Header row */}
        <div className="flex gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
          {[140, 96, 64, 80, 72, 80, 72].map((w, i) => (
            <div key={i} className={`skeleton h-3 rounded`} style={{ width: w }} />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={[
              "flex items-center gap-4 px-4 py-3 border-b border-slate-100",
              i % 2 === 1 ? "bg-slate-50/50" : "",
            ].join(" ")}
          >
            <div className="skeleton h-4 w-36" />
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-14" />
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-4 w-16" />
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-40" />
      </div>
    </div>
  );
}
