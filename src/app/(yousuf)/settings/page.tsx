import type { Metadata } from "next";
import { getGraceDays } from "@/lib/settings";
import { updateSettings } from "./actions";
import { SettingsForm } from "./SettingsForm";
import { DangerZone } from "./DangerZone";

export const metadata: Metadata = {
  title: "Settings — ISP Billing",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const graceDays = await getGraceDays();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
      <div className="card">
        <SettingsForm action={updateSettings} graceDays={graceDays} />
      </div>

      <DangerZone />
    </div>
  );
}
