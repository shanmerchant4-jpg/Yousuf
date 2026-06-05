import { CustomerStatus } from "@prisma/client";

const styles: Record<CustomerStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  OVERDUE: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  SUSPENDED: "bg-red-50 text-red-700 ring-1 ring-red-200",
  DISCONNECTED: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

const dots: Record<CustomerStatus, string> = {
  ACTIVE: "bg-emerald-500",
  OVERDUE: "bg-amber-500",
  SUSPENDED: "bg-red-500",
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
