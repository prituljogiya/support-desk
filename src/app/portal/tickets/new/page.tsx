import { NewTicketForm } from "@/components/new-ticket-form";

export default function NewTicketPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-sky-950">
          New ticket
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Describe your issue and we&apos;ll get back to you.
        </p>
      </div>
      <NewTicketForm />
    </div>
  );
}
