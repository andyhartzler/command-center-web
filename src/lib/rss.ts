// Server-side RSS parsing utility — no external dependencies

export interface Article {
  title: string;
  source: string;
  category: string;
  pubDate: string;
  link: string;
  snippet: string;
  imageURL: string | null;
}

/**
 * Strip CDATA wrappers, HTML tags, and decode common HTML entities.
 */
export function stripHTML(text: string): string {
  if (!text) return '';
  let cleaned = text;
  // Remove CDATA wrappers
  cleaned = cleaned.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D');
  // Strip all HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Extract text content from an XML element, handling CDATA.
 */
function getElementText(item: string, tag: string): string {
  // Try namespaced and non-namespaced variants
  const patterns = [
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'),
  ];
  for (const re of patterns) {
    const match = item.match(re);
    if (match) return match[1].trim();
  }
  return '';
}

/**
 * Extract an image URL from an RSS item using multiple strategies:
 * 1. media:content url attribute
 * 2. media:thumbnail url attribute
 * 3. enclosure with image type
 * 4. <image> child with <url>
 * 5. First <img src="..."> in description/content:encoded
 * 6. og-style image URL patterns in content
 */
function extractImageURL(item: string): string | null {
  // media:content
  const mediaContent = item.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*>/i);
  if (mediaContent) return mediaContent[1];

  // media:thumbnail
  const mediaThumbnail = item.match(/<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i);
  if (mediaThumbnail) return mediaThumbnail[1];

  // enclosure with image type
  const enclosure = item.match(/<enclosure[^>]+type=["']image\/[^"']*["'][^>]+url=["']([^"']+)["'][^>]*>/i);
  if (enclosure) return enclosure[1];
  // enclosure url-first variant
  const enclosure2 = item.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']*["'][^>]*>/i);
  if (enclosure2) return enclosure2[1];
  // enclosure without type (assume image if URL looks like one)
  const enclosureAny = item.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|gif|webp)[^"']*)["'][^>]*>/i);
  if (enclosureAny) return enclosureAny[1];

  // <img> tag in description or content:encoded
  const descriptionRaw = getElementText(item, 'description') || getElementText(item, 'content:encoded');
  if (descriptionRaw) {
    const imgMatch = descriptionRaw.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];
  }

  return null;
}

/**
 * Parse an RSS XML string into an array of Article objects.
 * Handles both RSS 2.0 (<item>) and Atom (<entry>) feeds.
 */
export function parseRSS(xml: string, source: string, category: string): Article[] {
  const articles: Article[] = [];

  // Determine feed format
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const itemTag = isAtom ? 'entry' : 'item';
  const itemRegex = new RegExp(`<${itemTag}[\\s>][\\s\\S]*?</${itemTag}>`, 'gi');
  const items = xml.match(itemRegex);

  if (!items) return articles;

  for (const item of items) {
    // Title
    const title = stripHTML(getElementText(item, 'title'));
    if (!title) continue;

    // Link — handle Atom <link href="..." /> and RSS <link>text</link>
    let link = '';
    if (isAtom) {
      const atomLink = item.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i)
        || item.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (atomLink) link = atomLink[1];
    }
    if (!link) {
      link = getElementText(item, 'link');
    }
    // Some feeds put CDATA in link
    link = stripHTML(link);

    // Publication date
    const pubDateRaw = getElementText(item, 'pubDate')
      || getElementText(item, 'published')
      || getElementText(item, 'updated')
      || getElementText(item, 'dc:date');
    const pubDate = pubDateRaw ? new Date(pubDateRaw).toISOString() : new Date().toISOString();

    // Snippet from description or summary
    const descriptionRaw = getElementText(item, 'description')
      || getElementText(item, 'summary')
      || getElementText(item, 'content:encoded');
    const snippet = stripHTML(descriptionRaw).slice(0, 300);

    // Image
    const imageURL = extractImageURL(item);

    articles.push({
      title,
      source,
      category,
      pubDate,
      link,
      snippet,
      imageURL,
    });
  }

  return articles;
}
