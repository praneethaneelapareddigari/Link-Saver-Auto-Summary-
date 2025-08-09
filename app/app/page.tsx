"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Bookmark } from "@/types";
import { normalizeUrl } from "@/lib/normalizeUrl";

export default function AppPage() {
  const router = useRouter();

  // auth
  const [userId, setUserId] = useState<string | null>(null);

  // form
  const [url, setUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  // ui/data
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Bookmark[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // 🌙 Dark mode (persisted)
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark =
      saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);
  function toggleDarkMode() {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  }

  // auth guard: set userId or go to /login
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUserId(data.user.id);
    })();
  }, [router]);

  // initial load once userId is known
  useEffect(() => {
    if (userId) void load(selectedTag ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function load(filterTag?: string | null) {
    if (!userId) return;

    let query = supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", userId) // ✅ scope to current user
      .order("created_at", { ascending: false });

    if (filterTag) query = query.contains("tags", [filterTag]);

    const { data, error } = await query;
    if (!error && data) setList(data as Bookmark[]);
  }

  async function addBookmark(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !url.trim()) return;

    const clean = normalizeUrl(url.trim());
    const tagArray = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      // duplicate check
      const { data: existing } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", userId)
        .eq("url", clean)
        .maybeSingle();
      if (existing) {
        alert("Already saved.");
        return;
      }

      // enrich
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: clean }),
      });
      const { title, favicon, summary, error } = await res.json();
      if (error) throw new Error(error);

      // insert
      const { error: insErr } = await supabase.from("bookmarks").insert([
        {
          user_id: userId,
          url: clean,
          title,
          favicon:
            favicon ||
            `https://www.google.com/s2/favicons?domain=${new URL(clean).hostname}&sz=64`,
          summary,
          tags: tagArray,
        },
      ]);

      if (insErr) {
        const code = (insErr as any).code;
        if (code === "23505") {
          alert("Already saved.");
          return;
        }
        throw insErr;
      }

      setUrl("");
      setTagsInput("");
      await load(selectedTag ?? null);
    } catch (err: any) {
      alert(err.message ?? "Failed to add");
    } finally {
      setLoading(false);
    }
  }

  async function del(id: string) {
    const { error } = await supabase.from("bookmarks").delete().eq("id", id);
    if (!error) setList((prev) => prev.filter((b) => b.id !== id));
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // tag cloud
  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const b of list) (b.tags ?? []).forEach((t) => s.add(t));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [list]);

  // client-side search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((b) => {
      const t = (b.title ?? "").toLowerCase();
      const u = (b.url ?? "").toLowerCase();
      const tg = (b.tags ?? []).join(" ").toLowerCase();
      return t.includes(q) || u.includes(q) || tg.includes(q);
    });
  }, [list, search]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 dark:bg-gray-900 dark:text-white min-h-screen">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Link Saver</h1>
        <div className="flex items-center gap-4">
          <button onClick={toggleDarkMode} className="text-sm underline">
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
          <button onClick={logout} className="text-sm underline">
            Logout
          </button>
        </div>
      </header>

      {/* Add form */}
      <form onSubmit={addBookmark} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="flex-1 border p-2 rounded dark:bg-gray-800 dark:border-gray-700"
          placeholder="Paste a URL (https://...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          type="url"
        />
        <input
          className="flex-1 border p-2 rounded dark:bg-gray-800 dark:border-gray-700"
          placeholder="Tags (comma separated)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />
        <button
          disabled={loading || !url.trim()}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </form>

      {/* Search */}
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, URL, or tag…"
          className="w-full border p-2 rounded dark:bg-gray-800 dark:border-gray-700"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-sm underline">
            Clear
          </button>
        )}
      </div>

      {/* Tag filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {allTags.length > 0 && (
          <span className="text-sm text-gray-600 dark:text-gray-300">Filter:</span>
        )}
        {allTags.map((t) => (
          <button
            key={t}
            onClick={() => {
              setSelectedTag(t);
              setSearch("");
              load(t);
            }}
            className={`text-xs px-2 py-1 rounded border dark:border-gray-700 ${
              selectedTag === t ? "bg-black text-white dark:bg-white dark:text-black" : ""
            }`}
            title={`Show tag: ${t}`}
          >
            #{t}
          </button>
        ))}
        {selectedTag && (
          <button
            onClick={() => {
              setSelectedTag(null);
              load(null);
            }}
            className="text-xs px-2 py-1 rounded border dark:border-gray-700"
            title="Clear filter"
          >
            Clear
          </button>
        )}
      </div>

      {/* Bookmarks list */}
      <ul className="space-y-3">
        {filtered.map((b) => (
          <li key={b.id} className="border rounded p-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              {b.favicon ? <img src={b.favicon} alt="" className="h-5 w-5" /> : null}
              <a
                href={b.url}
                target="_blank"
                className="font-medium underline break-all"
                rel="noopener noreferrer"
              >
                {b.title || b.url}
              </a>
            </div>

            {b.tags?.length ? (
              <div className="mt-1 flex gap-1 flex-wrap">
                {b.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedTag(tag);
                      load(tag);
                    }}
                    className="px-2 py-0.5 text-[11px] rounded border dark:border-gray-700"
                    title={`Filter by ${tag}`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : null}

            {b.summary ? (
              <p className="mt-2 text-sm whitespace-pre-line">{b.summary}</p>
            ) : null}

            <button onClick={() => del(b.id)} className="mt-2 text-xs underline">
              Delete
            </button>
          </li>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {search ? "No matches for your search." : "No bookmarks yet."}
          </p>
        )}
      </ul>
    </div>
  );
}
