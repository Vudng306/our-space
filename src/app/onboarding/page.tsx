import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getSpaceContextForUser } from "@/lib/space";
import OnboardingFlow from "./OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getSpaceContextForUser(user);
  if (ctx) redirect("/app");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <OnboardingFlow displayName={user.displayName} />
    </main>
  );
}
