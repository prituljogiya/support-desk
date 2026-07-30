"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ContactCompanyForms({ companies }: { companies: string[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [coName, setCoName] = useState("");
  const [coDomain, setCoDomain] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone: phone || null,
        companyName: companyName || null,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Failed");
      return;
    }
    setName("");
    setEmail("");
    setPhone("");
    setCompanyName("");
    setMsg("Contact created");
    router.refresh();
  }

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    // reuse contacts API company creation path via contact optional — use dedicated inline
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: coName, domain: coDomain || null }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Failed");
      return;
    }
    setCoName("");
    setCoDomain("");
    setMsg("Company created");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {msg ? (
        <p className="lg:col-span-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      ) : null}
      <form
        onSubmit={createContact}
        className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h3 className="font-semibold text-slate-900">Add contact</h3>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
        <input
          list="company-names"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Company (optional)"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
        <datalist id="company-names">
          {companies.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white"
        >
          Create contact
        </button>
      </form>

      <form
        onSubmit={createCompany}
        className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h3 className="font-semibold text-slate-900">Add company</h3>
        <input
          required
          value={coName}
          onChange={(e) => setCoName(e.target.value)}
          placeholder="Company name"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
        <input
          value={coDomain}
          onChange={(e) => setCoDomain(e.target.value)}
          placeholder="Domain (optional)"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white"
        >
          Create company
        </button>
      </form>
    </div>
  );
}
