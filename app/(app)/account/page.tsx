import { redirect } from "next/navigation";

/** The Account page was merged into Settings; keep old links and bookmarks working. */
export default function AccountPage() {
  redirect("/settings");
}
