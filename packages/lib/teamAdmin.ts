import { prisma } from "@calcom/prisma";
import { SchedulingType } from "@calcom/prisma/enums";

/**
 * OSS replacement for team administration utilities
 * This provides team admin checking without EE dependencies
 */

export async function isTeamAdmin(userId: number, teamId: number) {
  const team = await prisma.membership.findFirst({
    where: {
      userId,
      teamId,
      accepted: true,
      OR: [{ role: "ADMIN" }, { role: "OWNER" }],
    },
    include: {
      team: {
        select: {
          metadata: true,
          parentId: true,
          isOrganization: true,
        },
      },
    },
  });
  if (!team) return false;
  return team;
}

export async function isTeamOwner(userId: number, teamId: number) {
  return !!(await prisma.membership.findFirst({
    where: {
      userId,
      teamId,
      accepted: true,
      role: "OWNER",
    },
  }));
}

export async function isTeamMember(userId: number, teamId: number) {
  return !!(await prisma.membership.findFirst({
    where: {
      userId,
      teamId,
      accepted: true,
    },
  }));
}

// OSS implementation of team event type management
export async function updateNewTeamMemberEventTypes(userId: number, teamId: number) {
  const eventTypesToAdd = await prisma.eventType.findMany({
    where: {
      team: { id: teamId },
      assignAllTeamMembers: true,
    },
    select: {
      id: true,
      schedulingType: true,
    },
  });

  if (eventTypesToAdd.length > 0) {
    await prisma.$transaction(
      eventTypesToAdd.map((eventType) => {
        if (eventType.schedulingType === SchedulingType.MANAGED) {
          // For managed events, this would require the full EE implementation
          // In OSS mode, we'll just add the user as a host to the main event
          return prisma.eventType.update({
            where: { id: eventType.id },
            data: { hosts: { create: [{ userId, isFixed: false }] } },
          });
        } else {
          return prisma.eventType.update({
            where: { id: eventType.id },
            data: { hosts: { create: [{ userId, isFixed: eventType.schedulingType === SchedulingType.COLLECTIVE }] } },
          });
        }
      })
    );
  }
}
