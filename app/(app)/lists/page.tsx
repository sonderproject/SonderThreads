import { ListsBrowser } from "@/components/lists/ListsBrowser";
import { listLists, getListItemCounts } from "@/lib/actions/lists";

export default async function ListsPage() {
  const [lists, itemCounts] = await Promise.all([listLists(), getListItemCounts()]);

  return (
    <div className="space-y-4">
      <h1 className="font-mono text-xs uppercase tracking-wide text-text-faint">Lists</h1>
      <ListsBrowser lists={lists} itemCounts={itemCounts} />
    </div>
  );
}
