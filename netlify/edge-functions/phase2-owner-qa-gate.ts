/**
 * HTTP Basic Auth for the dedicated Phase 2 owner-QA Netlify site only.
 * Credentials come from deploy-scoped server env (never from visitors).
 */
export default async function phase2OwnerQaGate(
  request: Request,
  context: { next: () => Promise<Response> | Response },
) {
  const user = Netlify.env.get("PHASE2_OWNER_QA_EDGE_BASIC_AUTH_USER");
  const pass = Netlify.env.get("PHASE2_OWNER_QA_EDGE_BASIC_AUTH_PASS");
  if (!user || !pass) {
    return context.next();
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Basic ${btoa(`${user}:${pass}`)}`;
  if (authorization === expected) {
    return context.next();
  }

  return new Response("Owner QA preview — authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="624voice Phase 2 Owner QA", charset="UTF-8"',
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export const config = {
  path: "/*",
};
