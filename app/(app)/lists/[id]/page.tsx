import { notFound } from "next/navigation";
import { getListWithItems } from "@/lib/actions/lists";
import { ListDetail } from "@/components/lists/ListDetail";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getListWithItems(id);
  if (!data) notFound();

  return <ListDetail list={data.list} items={data.items} />;
}
