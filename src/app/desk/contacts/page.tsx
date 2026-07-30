import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/features";
import { ContactCompanyForms } from "@/components/contact-forms";

export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");
  if (!isStaffRole(session.user.membershipRole)) redirect("/portal");

  const orgId = session.user.organizationId;
  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({
      where: { organizationId: orgId },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { contacts: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 bg-gradient-to-br from-slate-50 to-sky-50/30 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Contacts & companies
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          CRM-lite for requesters linked to tickets.
        </p>
      </div>

      <ContactCompanyForms companies={companies.map((c) => c.name)} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">
            Contacts ({contacts.length})
          </div>
          <ul className="divide-y divide-slate-100">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-slate-500">
                    {c.email}
                    {c.company ? ` · ${c.company.name}` : ""}
                  </div>
                </div>
                <span className="text-xs text-slate-400">
                  {c._count.tickets} tickets
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">
            Companies ({companies.length})
          </div>
          <ul className="divide-y divide-slate-100">
            {companies.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                No companies yet.
              </li>
            ) : (
              companies.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium text-slate-900">{c.name}</div>
                    <div className="text-slate-500">{c.domain || "—"}</div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {c._count.contacts} contacts
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
