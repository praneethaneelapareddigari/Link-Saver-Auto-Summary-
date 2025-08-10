import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // avoid static caching of API route

const TEXT_HTML_RE = /text\/html/i;
const TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;

function findIconHref(html: string): string | null {
  const tag = html.match(
    /<link[^>]+rel=["'](?:shortcut\s+icon|apple-touch-icon|icon)["'][^>]*>/i
  )?.[0];
  if (!tag) return null;
  return tag.match(/href=["']([^"']+)["']/i)?.[1] ?? null;
}

function sanitizeTitle(t?: string) {
  return (t ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
}

async function fetchWithTimeout(url: string, ms = 12000, init?: RequestInit) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { signal: c.signal, ...init });
  } finally {
    clearTimeout(id);
  }
}

/** Appendix-spec call:
 * GET https://r.jina.ai/http://<URL_ENCODED_TARGET_PAGE>
 * With debug logs so you can see exactly what’s called.
 */
async function getJinaSummary(targetUrl: string) {
  const encoded = encodeURIComponent(targetUrl);
  const jina = `https://r.jina.ai/http://${encoded}`; // correct pattern per spec

  // DEBUG: log what we call + status
  console.log("[enrich] Jina URL:", jina);

  let r = await fetchWithTimeout(jina, 12000, { headers: { Accept: "text/plain" } });
  console.log("[enrich] Jina status:", r.status);

  // tiny retry for 5xx flakiness
  if (!r.ok && r.status >= 500) {
    await new Promise((res) => setTimeout(res, 700));
    r = await fetchWithTimeout(jina, 12000, { headers: { Accept: "text/plain" } });
    console.log("[enrich] Jina retry status:", r.status);
  }

  if (r.status === 429) throw new Error("Rate limited by Jina (429). Try again later.");
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Jina ${r.status}: ${body.slice(0, 300)}`);
  }

  const text = (await r.text()).trim();
  if (text.length < 40) return ""; // treat tiny responses as empty
  return text.slice(0, 5000);
}

// Optional: quick health check
export function GET() {
  return NextResponse.json({ ok: true, route: "/api/enrich" });
}

export async function POST(req: NextRequest) {
  try {
    let { url } = await req.json();

    // accept bare domains (add https:// if missing)
    if (typeof url === "string" && !/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    // validate URL
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // best-effort title + favicon
    let title = target.hostname;
    let faviconAbs = `https://www.google.com/s2/favicons?domain=${target.hostname}&sz=64`;

    try {
      const res = await fetchWithTimeout(target.toString(), 12000, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const ct = res.headers.get("content-type") ?? "";
      if (res.ok && TEXT_HTML_RE.test(ct)) {
        const html = await res.text();
        title = sanitizeTitle(html.match(TITLE_RE)?.[1]) || title;
        const href = findIconHref(html);
        if (href) {
          try {
            faviconAbs = new URL(href, target.origin).toString();
          } catch {}
        }
      }
    } catch {
      // ignore; keep defaults
    }

    // Jina summary (per appendix)
    try {
      const summary = await getJinaSummary(target.toString());
      return NextResponse.json({ title, favicon: faviconAbs, summary });
    } catch (e: any) {
      // return metadata + helpful error; summary empty so UI shows placeholder
      return NextResponse.json({
        title,
        favicon: faviconAbs,
        summary: "",
        error: e?.message,
      });
    }
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "Upstream timeout" : e?.message || "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
