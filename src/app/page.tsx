import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getSpaceContextForUser } from "@/lib/space";

export const dynamic = "force-dynamic";

/** There is no public landing page — everything here belongs to two people. */
export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getSpaceContextForUser(user);
  redirect(ctx ? "/app" : "/onboarding");
}
