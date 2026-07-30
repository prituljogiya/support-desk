"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Article = {
  id: string;
  title: string;
  slug: string;
  body: string;
  category: string;
  published: boolean;
  updatedAt: string;
};

export function KnowledgeWorkspace({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Article | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(query = q) {
    const res = await fetch(
      `/api/knowledge${query ? `?q=${encodeURIComponent(query)}` : ""}`,
    );
    const data = await res.json();
    if (res.ok) {
      setArticles(data.articles ?? []);
      if (!selected && data.articles?.[0]) setSelected(data.articles[0]);
    } else {
      setError(data.error || "Failed to load");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createArticle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, category }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Create failed");
      return;
    }
    setTitle("");
    setBody("");
    setCategory("General");
    await load();
    setSelected(data.article);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    setBusy(false);
    setSelected(null);
    await load();
    router.refresh();
  }

  const categories = Array.from(new Set(articles.map((a) => a.category)));

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-gradient-to-br from-slate-50 to-sky-50/30">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">Knowledge base</h1>
        <p className="mt-1 text-sm text-slate-500">
          Help articles agents and customers can reuse.
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(q);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search articles…"
            className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white"
          >
            Search
          </button>
        </form>
      </div>

      {error ? (
        <p className="mx-6 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 p-6 lg:grid-cols-[280px_1fr_320px]">
        <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 text-xs font-semibold uppercase text-slate-400">
            Categories
          </div>
          <button
            type="button"
            onClick={() => void load("")}
            className="mb-2 block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-50"
          >
            All ({articles.length})
          </button>
          {categories.map((c) => (
            <div key={c} className="mb-3">
              <div className="px-2 text-xs font-medium text-slate-500">{c}</div>
              <ul className="mt-1 space-y-0.5">
                {articles
                  .filter((a) => a.category === c)
                  .map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(a)}
                        className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                          selected?.id === a.id
                            ? "bg-sky-50 text-sky-900"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        {a.title}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    {selected.category}
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">
                    {selected.title}
                  </h2>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(selected.id)}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                {selected.body}
              </pre>
              <p className="mt-6 text-xs text-slate-400">
                Tip: paste snippets into ticket replies from the composer.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select an article to read.</p>
          )}
        </section>

        {canManage ? (
          <form
            onSubmit={createArticle}
            className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h3 className="font-semibold text-slate-900">New article</h3>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            />
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            />
            <textarea
              required
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Article body"
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-sky-700 px-3 py-2 text-sm text-white"
            >
              Publish article
            </button>
            <Link href="/desk/admin" className="block text-center text-xs text-sky-700">
              More admin tools →
            </Link>
          </form>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
            Only org admins can publish articles.
          </div>
        )}
      </div>
    </div>
  );
}
