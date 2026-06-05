export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard" aria-busy="true">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-36" />
        <div className="skeleton hidden h-5 w-52 sm:block" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card space-y-3">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-9 w-16" />
          </div>
        ))}
      </div>

      {/* Collections + due soon */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-3">
          <div className="skeleton h-3 w-36" />
          <div className="skeleton h-9 w-28" />
          <div className="skeleton h-3 w-20" />
        </div>
        <div className="card space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-24" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="skeleton h-4 w-40" />
              <div className="flex items-center gap-3">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
