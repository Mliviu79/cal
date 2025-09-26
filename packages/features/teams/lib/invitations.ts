import { prisma } from "@calcom/prisma";
import { MembershipRole } from "@calcom/prisma/enums";

export class TeamInviteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamInviteError";
  }
}

export async function acceptTeamInviteByToken({
  token,
  userId,
}: {
  token: string;
  userId: number;
}) {
  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token,
      OR: [{ expiresInDays: null }, { expires: { gte: new Date() } }],
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!verificationToken || !verificationToken.team || !verificationToken.teamId) {
    throw new TeamInviteError("Invite token is invalid or expired");
  }

  // Narrow type: we validated teamId exists above
  const teamId = verificationToken.teamId as number;

  const membershipKey = {
    userId_teamId: {
      userId,
      teamId,
    },
  } as const;

  await prisma.$transaction(async (tx) => {
    const existingMembership = await tx.membership.findUnique({ where: membershipKey });

    if (existingMembership?.accepted) {
      throw new TeamInviteError("You are already a member of this team.");
    }

    if (existingMembership) {
      await tx.membership.update({
        where: membershipKey,
        data: {
          accepted: true,
        },
      });
    } else {
      await tx.membership.create({
        data: {
          teamId,
          userId,
          role: MembershipRole.MEMBER,
          accepted: true,
          createdAt: new Date(),
        },
      });
    }

    await tx.verificationToken.delete({
      where: {
        id: verificationToken.id,
      },
    });
  });

  return verificationToken.team.name;
}
