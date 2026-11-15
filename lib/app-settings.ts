import { queryOne } from "@/lib/db/client";

/** The one-row app_settings table: maintenance mode and the announcement banner (set in the command center). */
export type AppSettings = {
  maintenanceOn: boolean;
  maintenanceMessage: string | null;
  maintenanceUntil: Date | null;
  announcementId: string | null;
  announcementText: string | null;
  announcementLink: string | null;
};

const OFF: AppSettings = {
  maintenanceOn: false,
  maintenanceMessage: null,
  maintenanceUntil: null,
  announcementId: null,
  announcementText: null,
  announcementLink: null,
};

// Read on every signed-in request, so it's kept for 15 seconds per server instance.
let cached: { at: number; value: AppSettings } | null = null;
const TTL_MS = 15_000;

export async function getAppSettings(): Promise<AppSettings> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  try {
    const row = await queryOne<{
      maintenance_on: boolean;
      maintenance_message: string | null;
      maintenance_until: string | null;
      announcement_id: string | null;
      announcement_text: string | null;
      announcement_link: string | null;
    }>(`select * from app_settings where id`);
    const value: AppSettings = row
      ? {
          maintenanceOn: row.maintenance_on,
          maintenanceMessage: row.maintenance_message,
          maintenanceUntil: row.maintenance_until ? new Date(row.maintenance_until) : null,
          announcementId: row.announcement_id,
          announcementText: row.announcement_text,
          announcementLink: row.announcement_link,
        }
      : OFF;
    cached = { at: Date.now(), value };
    return value;
  } catch (err) {
    // Never lock everyone out because this read failed.
    console.error("[app-settings] read failed", err instanceof Error ? err.message : err);
    return cached?.value ?? OFF;
  }
}

/** After the owner changes a setting, this server instance sees it at once (others within 15 seconds). */
export function clearAppSettingsCache(): void {
  cached = null;
}

/** Maintenance on right now? It stays on until the owner turns it off; the end time is only shown to people. */
export function inMaintenance(s: AppSettings): boolean {
  return s.maintenanceOn;
}
