import { getNotificationsFeed } from "@/lib/actions/notifications";
import { listPeople } from "@/lib/actions/people";
import { NotificationsFeed } from "@/components/notifications/NotificationsFeed";

export default async function NotificationsPage() {
  const [feed, people] = await Promise.all([getNotificationsFeed(), listPeople()]);
  const personNames = Object.fromEntries(people.map((p) => [p.id, p.display_name]));

  return (
    <div className="space-y-8">
      <h1 className="font-mono text-xs uppercase tracking-wide text-text-faint">Notifications</h1>
      <NotificationsFeed {...feed} personNames={personNames} />
    </div>
  );
}
