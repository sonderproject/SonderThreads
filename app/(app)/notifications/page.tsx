import { getPendingInvites } from "@/lib/org";
import { PendingInvites } from "@/components/org/PendingInvites";
import { getNotificationsFeed } from "@/lib/actions/notifications";
import { listPeople } from "@/lib/actions/people";
import { NotificationsFeed } from "@/components/notifications/NotificationsFeed";

export default async function NotificationsPage() {
  const [feed, people, invites] = await Promise.all([getNotificationsFeed(), listPeople(), getPendingInvites()]);
  const personNames = Object.fromEntries(people.map((p) => [p.id, p.display_name]));

  return (
    <div className="space-y-8">
      <h1 className="page-title">Notifications</h1>
      <PendingInvites invites={invites} />
      <NotificationsFeed {...feed} personNames={personNames} />
    </div>
  );
}
