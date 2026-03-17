// Cloudflare Worker — KolShek Feedback → GitHub Issues
// Deploy: npx wrangler deploy
// Secret: wrangler secret put GITHUB_TOKEN (fine-grained PAT with issues:write on DaveDushi/kolshek)

const REPO = "DaveDushi/kolshek";
const ALLOWED_ORIGINS = [
  "https://davedushi.github.io",
  "https://kolshek.com",
  "http://localhost:5173",
  "http://localhost:4173",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.find((o) => origin?.startsWith(o));
  return {
    "Access-Control-Allow-Origin": allowed || ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers });
    }

    try {
      const { type, title, details } = await request.json();

      if (!title || !details) {
        return Response.json(
          { error: "Title and details are required" },
          { status: 400, headers },
        );
      }

      const labels = [];
      labels.push("feedback");
      if (type === "bug") labels.push("bug");
      if (type === "feature") labels.push("enhancement");

      const body =
        `## Type\n${type}\n\n## Details\n${details}` +
        `\n\n---\n*Submitted via kolshek.dev feedback form*`;

      const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "kolshek-feedback-worker",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          title: `[Feedback] ${title}`,
          body,
          labels,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return Response.json(
          { error: "GitHub API error", detail: err },
          { status: 502, headers },
        );
      }

      const issue = await res.json();
      return Response.json(
        { success: true, url: issue.html_url, number: issue.number },
        { status: 201, headers },
      );
    } catch (err) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers },
      );
    }
  },
};
