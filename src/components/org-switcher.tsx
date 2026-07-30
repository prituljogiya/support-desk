"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Membership = {
  organizationId: string;
  role: string;
  organization: { id: string; name: string; slug: string };
};

export function OrgSwitcher() {
  const { data: session, update } = useSession();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/orgs/switch")
      .then((r) => r.json())
      .then((data) => setMemberships(data.memberships ?? []))
      .catch(() => setMemberships([]));
  }, []);

  async function onChange(organizationId: string) {
    if (!organizationId || organizationId === session?.user?.organizationId) {
      return;
    }
    setLoading(true);
    const res = await fetch("/api/orgs/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    if (res.ok) {
      await update({ organizationId });
      window.location.reload();
    }
    setLoading(false);
  }

  if (memberships.length <= 1) {
    return (
      <span className="truncate text-sm font-medium text-slate-700">
        {session?.user?.organizationName || "Organization"}
      </span>
    );
  }

  return (
    <select
      disabled={loading}
      value={session?.user?.organizationId ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-[200px] truncate rounded border border-slate-200 bg-white px-2 py-1 text-sm"
    >
      {memberships.map((m) => (
        <option key={m.organizationId} value={m.organizationId}>
          {m.organization.name}
        </option>
      ))}
    </select>
  );
}
