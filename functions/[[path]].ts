/**
 * Cloudflare Pages Function — catch-all handler for og.nhalife.com
 *
 * Purpose:
 * - Bot request (Telegram, WhatsApp, Facebook, VK, Slack, Twitter):
 *   → Proxy HTML from Convex HTTP Action (with OG meta tags)
 * - Human request:
 *   → 302 redirect to nhalife.com (main SPA)
 *
 * Deployment:
 *   Place this file at: functions/[[path]].ts in your Cloudflare Pages project
 */

const CONVEX_SITE = "https://little-jellyfish-602.convex.site";
const MAIN_SITE = "https://nhalife.com";

/** Bot User-Agent patterns for crawlers that do NOT execute JavaScript */
const BOT_UA_PATTERNS = [
  "TelegramBot",
  "WhatsApp",
  "facebookexternalhit",
  "Facebot",
  "vkShare",
  "Slackbot",
  "Twitterbot",
  "LinkedInBot",
  "Discordbot",
  "Pinterestbot",
  "Viber",
  "Line",
  "Zalo",
];

/** Determine the Convex HTTP Action path from the request URL */
function resolveOgPath(pathname: string): string | null {
  // Expected URL patterns:
  // /{lang}/business/{slug}     → /og/business/{slug}?lang={lang}
  // /{lang}/trip/{slug}         → /og/trip/{slug}?lang={lang}
  // /{lang}/events/{id}         → /og/event/{id}?lang={lang}
  // /{lang}/collections/{slug}  → /og/collection/{slug}?lang={lang}
  // /{lang}/marketplace/{slug}  → /og/listing/{slug}?lang={lang}
  // /{lang}/news/{slug}         → /og/news/{slug}?lang={lang}
  // /{lang}/explore/{...}       → /og/explore/{...}?lang={lang}

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

function isBot(userAgent: string): boolean {
  return BOT_UA_PATTERNS.some((pattern) =>
    userAgent.toLowerCase().includes(pattern.toLowerCase())
  );
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent") || "";

  // If not a bot, redirect to main site
  if (!isBot(userAgent)) {
    const redirectUrl = `${MAIN_SITE}${url.pathname}`;
    return Response.redirect(redirectUrl, 302);
  }

  // Resolve the Convex HTTP Action path
  const ogPath = resolveOgPath(url.pathname);

  if (!ogPath) {
    // Fallback: redirect to main site if path doesn't match known patterns
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
      // If Convex returns error, redirect to main site
      return Response.redirect(`${MAIN_SITE}${url.pathname}`, 302);
    }

    const html = await response.text();

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    // On any fetch error, redirect to main site
    return Response.redirect(`${MAIN_SITE}${url.pathname}`, 302);
  }
};
