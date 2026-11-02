import { CheckInsBrowser } from "@/components/check-ins/CheckInsBrowser";
import { listCheckIns, listCheckInReasons } from "@/lib/actions/check-ins";
import { listPeople } from "@/lib/actions/people";

export default async function CheckInsPage() {
  const [checkIns, people, reasons] = await Promise.all([
    listCheckIns(),
    listPeople(),
    listCheckInReasons(),
  ]);
  const sortedPeople = people
    .map((p) => ({ id: p.id, display_name: p.display_name }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <div className="space-y-4">
      <h1 className="page-title">Check-ins</h1>
      <CheckInsBrowser checkIns={checkIns} people={sortedPeople} reasons={reasons} />
    </div>
  );
}
