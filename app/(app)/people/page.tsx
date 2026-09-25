import { PeopleBrowser } from "@/components/people/PeopleBrowser";
import { listPeople } from "@/lib/actions/people";

export default async function PeoplePage() {
  const people = await listPeople();

  return (
    <div className="space-y-4">
      <h1 className="font-mono text-xs uppercase tracking-wide text-text-faint">People</h1>
      <PeopleBrowser people={people} />
    </div>
  );
}
