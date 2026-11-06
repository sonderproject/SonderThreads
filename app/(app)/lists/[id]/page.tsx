import { notFound } from "next/navigation";
import { getListWithItems } from "@/lib/actions/lists";
import { ListDetail } from "@/components/lists/ListDetail";
import { listPeople } from "@/lib/actions/people";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, people] = await Promise.all([getListWithItems(id), listPeople()]);
  if (!data) notFound();

  const roster = data.list.is_group
    ? people.map((p) => ({ id: p.id, display_name: p.display_name })).sort((a, b) => a.display_name.localeCompare(b.display_name))
    : [];
  return <ListDetail list={data.list} items={data.items} people={roster} />;
}
