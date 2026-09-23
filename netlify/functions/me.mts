import { verifySession } from "./_shared/auth";
import { unauthorized } from "./_shared/http";

export default async (req: Request) => {
  const user = verifySession(req);
  return user ? Response.json({ user }) : unauthorized();
};
