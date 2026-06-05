import { CustomerStatus } from "@prisma/client";

const styles: Record<CustomerStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  OVERDUE: "bg-amber-100 text-amber-700",
  SUSPENDED: "bg-red-100 text-red-700",
  DISCONNECTED: "bg-slate-200 text-slate-600",
};

export function StatusBadge({ status }: { status: CustomerStatus }) {
  return <span className={`badge ${styles[status]}`}>{status}</span>;
}
