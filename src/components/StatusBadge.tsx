import { CustomerStatus } from "@prisma/client";

const styles: Record<CustomerStatus, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  OVERDUE: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  SUSPENDED: "bg-red-500/15 text-red-300 ring-red-500/30",
  DISCONNECTED: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
};

const dots: Record<CustomerStatus, string> = {
  ACTIVE: "bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/60",
  OVERDUE: "bg-amber-400 shadow-[0_0_6px] shadow-amber-400/60",
  SUSPENDED: "bg-red-400 shadow-[0_0_6px] shadow-red-400/60",
  DISCONNECTED: "bg-slate-400",
};

const labels: Record<CustomerStatus, string> = {
  ACTIVE: "Active",
  OVERDUE: "Overdue",
  SUSPENDED: "Suspended",
  DISCONNECTED: "Disconnected",
};

export function StatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span className={`badge ${styles[status]}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dots[status]}`} aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
