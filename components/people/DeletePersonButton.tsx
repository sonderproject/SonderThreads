"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useUndo } from "@/components/ui/UndoToast";
import { deletePersonRecord, restorePersonRecord } from "@/lib/actions/people";

export function DeletePersonButton({ personId, name }: { personId: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const undo = useUndo();

  async function handleDelete() {
    if (!confirm(`Delete ${name}? Their notes and tasks stay, unlinked.`)) return;
    setBusy(true);
    await deletePersonRecord(personId);
    router.push("/people");
    undo.show(`Deleted ${name}`, async () => {
      await restorePersonRecord(personId);
      router.push(`/people/${personId}`);
    });
  }

  return (
    <Button variant="danger" onClick={handleDelete} disabled={busy} className="ml-auto shrink-0">
      {busy ? "Deleting…" : "Delete"}
    </Button>
  );
}
