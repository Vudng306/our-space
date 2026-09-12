import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getSpaceContextForUser } from "@/lib/space";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getSpaceContextForUser(user);
  if (!ctx) redirect("/onboarding");

  return (
    <AppShell
      spaceName={ctx.space.name}
      me={{ id: user.id, displayName: user.displayName, avatarMediaId: user.avatarMediaId }}
      partner={
        ctx.partner
          ? {
              id: ctx.partner.userId,
              displayName: ctx.partner.displayName,
              avatarMediaId: ctx.partner.avatarMediaId,
            }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
