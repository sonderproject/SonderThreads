import { ClientsBrowser } from "@/components/clients/ClientsBrowser";
import { listClients } from "@/lib/actions/clients";

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <div className="space-y-4">
      <h1 className="font-mono text-xs uppercase tracking-wide text-text-faint">Clients</h1>
      <ClientsBrowser clients={clients} />
    </div>
  );
}
