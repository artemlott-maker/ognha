/**
 * Cloudflare Pages Function — catch-all handler for og.nhalife.com
 *
 * Always serves OG HTML from Convex HTTP Action.
 * This subdomain exists solely for link previews in messengers.
 * Humans who land here see a simple page with business info + JS redirect.
 */

const CONVEX_SITE = "https://little-jellyfish-602.convex.site";
const MAIN_SITE = "https://nhalife.com";

/** Determine the Convex HTTP Action path from the request URL */
function resolveOgPath(pathname: string): string | null {
  const clean = pathname.replace(/\/$/, "") || "/";

  const match = clean.match(
    /^\/(ru|en|vi|ko|zh)\/(business|trip|events|collections|marketplace|news|explore)\/(.+)$/
  );

  if (!match) return null;

  const [, lang, section, rest] = match;

  const sectionMap: Record<string, string> = {
    business: "business",
    trip: "trip",
    events: "event",
    collections: "collection",
    marketplace: "listing",
    news: "news",
    explore: "explore",
  };

  const ogSection = sectionMap[section];
  if (!ogSection) return null;

  return `/og/${ogSection}/${rest}?lang=${lang}`;
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const url = new URL(request.url);

  // Resolve the Convex HTTP Action path
  const ogPath = resolveOgPath(url.pathname);

  if (!ogPath) {
    // Unknown path — redirect to main site
    return Response.redirect(`${MAIN_SITE}${url.pathname}`, 302);
  }

  // Fetch HTML from Convex HTTP Action
  const convexUrl = `${CONVEX_SITE}${ogPath}`;

  try {
    const response = await fetch(convexUrl, {
      headers: {
        "User-Agent": "og.nhalife.com proxy",
      },
    });

    if (!response.ok) {
      return Response.redirect(`${MAIN_SITE}${url.pathname}`, 302);
    }

    const html = await response.text();

    // Inject a JS redirect for human visitors (bots ignore JS)
    const redirectScript = `<script>window.location.replace("${MAIN_SITE}${url.pathname}")</script>`;
    const enhancedHtml = html.replace("</head>", `${redirectScript}\n</head>`);

    return new Response(enhancedHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return Response.redirect(`${MAIN_SITE}${url.pathname}`, 302);
  }
};
