/**
 * HTTP Basic Auth for the dedicated Phase 2 owner-QA Netlify site only.
 * Credentials come from deploy-scoped server env (never from visitors).
 */
const ROBOTS_META = '<meta name="robots" content="noindex, nofollow"/>';
const ROBOTS_HEADER = "noindex, nofollow, noarchive";

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
  if (authorization !== expected) {
    return new Response("Owner QA preview — authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="624voice Phase 2 Owner QA", charset="UTF-8"',
        "X-Robots-Tag": ROBOTS_HEADER,
      },
    });
  }

  const response = await context.next();
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", ROBOTS_HEADER);
    return new Response(response.body, { status: response.status, headers });
  }

  const html = await response.text();
  const withMeta = html.includes('name="robots"')
    ? html
    : html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${ROBOTS_META}`);
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", ROBOTS_HEADER);
  headers.delete("content-length");
  return new Response(withMeta, { status: response.status, headers });
}

export const config = {
  path: "/*",
};
