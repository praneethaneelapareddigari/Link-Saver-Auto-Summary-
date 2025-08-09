import { NextRequest, NextResponse } from "next/server";

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
  if (!t) return "";
  return t.replace(/\s+/g, " ").trim().slice(0, 180);
}

async function fetchWithTimeout(url: string, ms = 8000, init?: RequestInit) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { signal: c.signal, ...init });
  } finally {
    clearTimeout(id);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

    // Validate & normalize URL (forces protocol)
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }

    // 1) Fetch HTML (best-effort)
    let html = "";
    try {
      const pageRes = await fetchWithTimeout(target.toString(), 8000, {
        redirect: "follow",
        headers: { "User-Agent": "LinkSaverBot/1.0 (+https://example.local)" },
      });
      const ct = pageRes.headers.get("content-type") || "";
      if (TEXT_HTML_RE.test(ct)) html = await pageRes.text();
    } catch {
      // ignore; proceed with fallbacks
    }

    // 2) Title
    let title = sanitizeTitle(html.match(TITLE_RE)?.[1]) || target.hostname;

    // 3) Favicon with fallbacks
    let favicon = "";
    try {
      const iconHref = findIconHref(html);
      if (iconHref) favicon = new URL(iconHref, target).toString();
    } catch {
      // ignore
    }
    if (!favicon) {
      favicon = `https://www.google.com/s2/favicons?domain=${target.hostname}&sz=64`;
    }
    if (!favicon) {
      favicon = `https://${target.hostname}/favicon.ico`;
    }

    // 4) Jina summary (best-effort, trimmed)
    let summary = "";
    try {
      const enc = encodeURIComponent(target.toString());
      const jinaRes = await fetchWithTimeout(`https://r.jina.ai/http://${enc}`, 9000);
      if (jinaRes.ok) {
        summary = (await jinaRes.text()).slice(0, 8000); // guard size
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ title, favicon, summary });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
