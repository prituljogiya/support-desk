import { prisma } from "@/lib/prisma";
import { getSectorPack } from "@/lib/sectors";
import { isDeskRole } from "@/lib/permissions";

/** Apply industry pack: tags, canned replies, default SLA, departments note. */
export async function applySectorPack(
  organizationId: string,
  industry: string,
) {
  const pack = getSectorPack(industry);

  await prisma.organization.update({
    where: { id: organizationId },
    data: { industry: pack.key },
  });

  for (const tag of pack.tags) {
    await prisma.tag.upsert({
      where: {
        organizationId_name: { organizationId, name: tag.name },
      },
      create: {
        organizationId,
        name: tag.name,
        color: tag.color,
      },
      update: { color: tag.color },
    });
  }

  for (const c of pack.canned) {
    const existing = await prisma.cannedResponse.findFirst({
      where: { organizationId, title: c.title },
    });
    if (!existing) {
      await prisma.cannedResponse.create({
        data: {
          organizationId,
          title: c.title,
          body: c.body,
        },
      });
    }
  }

  const defaultSla = await prisma.slaPolicy.findFirst({
    where: { organizationId, isDefault: true },
  });
  if (defaultSla) {
    await prisma.slaPolicy.update({
      where: { id: defaultSla.id },
      data: {
        firstResponseMinutes: pack.firstResponseMinutes,
        resolutionMinutes: pack.resolutionMinutes,
        name: `${pack.key} default`,
      },
    });
  } else {
    await prisma.slaPolicy.create({
      data: {
        organizationId,
        name: `${pack.key} default`,
        firstResponseMinutes: pack.firstResponseMinutes,
        resolutionMinutes: pack.resolutionMinutes,
        isDefault: true,
      },
    });
  }

  return pack;
}

/** Notify all desk staff (except actor) about a new/updated ticket. */
export async function notifyDeskStaff(opts: {
  organizationId: string;
  title: string;
  body: string;
  link: string;
  excludeUserId?: string;
  type?: string;
}) {
  const members = await prisma.membership.findMany({
    where: {
      organizationId: opts.organizationId,
      disabled: false,
    },
    select: { userId: true, role: true },
  });

  const targets = members.filter(
    (m) =>
      isDeskRole(m.role) &&
      m.userId !== opts.excludeUserId,
  );

  if (!targets.length) return;

  await prisma.notification.createMany({
    data: targets.map((m) => ({
      organizationId: opts.organizationId,
      userId: m.userId,
      type: opts.type || "ticket",
      title: opts.title,
      body: opts.body.slice(0, 500),
      link: opts.link,
    })),
  });
}
