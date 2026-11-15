import { notFound } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { getListWithItems } from "@/lib/actions/lists";
import { ListDetail } from "@/components/lists/ListDetail";
import { listPeople } from "@/lib/actions/people";
import { EmailEveryone } from "@/components/lists/EmailEveryone";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [data, people] = await Promise.all([getListWithItems(id), listPeople()]);
  if (!data) notFound();

  const roster = data.list.is_group
    ? people.map((p) => ({ id: p.id, display_name: p.display_name })).sort((a, b) => a.display_name.localeCompare(b.display_name))
    : [];
  // Email everyone on the list (people with an email address), through the person's own email app.
  const byId = new Map(people.map((p) => [p.id, p.email]));
  const onList = [...new Set(data.items.map((i) => i.person_id).filter((x): x is string => Boolean(x)))];
  const emails = [...new Set(onList.map((pid) => byId.get(pid)?.trim().toLowerCase()).filter((e): e is string => Boolean(e && e.includes("@"))))];
  return (
    <>
      <ListDetail list={data.list} items={data.items} people={roster} />
      <EmailEveryone listName={data.list.name} emails={emails} missing={onList.length - emails.length} />
    </>
  );
}
