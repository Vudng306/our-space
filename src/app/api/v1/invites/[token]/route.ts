import { handler, json } from "@/lib/api";
import { peekInvite } from "@/server/spaces";

export const runtime = "nodejs";

/** Public: shows only the space name and who invited you. */
export const GET = handler(async (_req: Request, ctxParam: { params: Promise<{ token: string }> }) => {
  const { token } = await ctxParam.params;
  return json(await peekInvite(token));
});
