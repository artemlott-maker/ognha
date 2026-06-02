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

  // Homepage: /{lang} or /{lang}/
  const homeMatch = clean.match(/^\/(ru|en|vi|ko|zh)$/);
  if (homeMatch) {
    return `/og/home/?lang=${homeMatch[1]}`;
  }

  // Coupons list: /{lang}/coupons
  const couponsListMatch = clean.match(/^\/(ru|en|vi|ko|zh)\/coupons$/);
  if (couponsListMatch) {
    return `/og/coupons/?lang=${couponsListMatch[1]}`;
  }

  // Single coupon: /{lang}/coupons/{couponId}
  const couponMatch = clean.match(/^\/(ru|en|vi|ko|zh)\/coupons\/(.+)$/);
  if (couponMatch) {
    return `/og/coupon/${couponMatch[2]}?lang=${couponMatch[1]}`;
  }

  // Guides: /{lang}/guides/{slug}
  const guideMatch = clean.match(/^\/(ru|en|vi|ko|zh)\/guides\/(.+)$/);
  if (guideMatch) {
    return `/og/guide/${guideMatch[2]}?lang=${guideMatch[1]}`;
  }

  // Areas: /{lang}/areas/{slug}
  const areaMatch = clean.match(/^\/(ru|en|vi|ko|zh)\/areas\/([^/]+)$/);
  if (areaMatch) {
    return `/og/area/${areaMatch[2]}?lang=${areaMatch[1]}`;
  }

  // Best/Intent: /{lang}/best/{slug}
  const bestMatch = clean.match(/^\/(ru|en|vi|ko|zh)\/best\/(.+)$/);
  if (bestMatch) {
    return `/og/best/${bestMatch[2]}?lang=${bestMatch[1]}`;
  }

  // Jobs: /{lang}/jobs/{jobId}
  const jobMatch = clean.match(/^\/(ru|en|vi|ko|zh)\/jobs\/(.+)$/);
  if (jobMatch) {
    return `/og/job/${jobMatch[2]}?lang=${jobMatch[1]}`;
  }

  // User profile: /{lang}/user/{nickname}
  const userMatch = clean.match(/^\/(ru|en|vi|ko|zh)\/user\/(.+)$/);
  if (userMatch) {
    return `/og/user/${userMatch[2]}?lang=${userMatch[1]}`;
  }

  // Marketplace seller shop: /{lang}/marketplace/shop/{sellerId}
  const shopMatch = clean.match(/^\/(ru|en|vi|ko|zh)\/marketplace\/shop\/(.+)$/);
  if (shopMatch) {
    return `/og/shop/${shopMatch[2]}?lang=${shopMatch[1]}`;
  }

  // Existing section-based routes
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
