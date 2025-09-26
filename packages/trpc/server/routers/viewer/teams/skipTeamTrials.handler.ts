import { TeamBilling } from "@calcom/lib/billing/ossTeamBilling";
import { IS_SELF_HOSTED } from "@calcom/lib/constants";
import logger from "@calcom/lib/logger";
import { MembershipRepository } from "@calcom/lib/server/repository/membership";
import { prisma } from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";

import type { TSkipTeamTrialsInputSchema } from "./skipTeamTrials.schema";

const log = logger.getSubLogger({ prefix: ["skipTeamTrials"] });

type SkipTeamTrialsOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TSkipTeamTrialsInputSchema;
};

export const skipTeamTrialsHandler = async ({ ctx }: SkipTeamTrialsOptions) => {
  // If self-hosted, no need to skip trials as they're already handled differently
  if (IS_SELF_HOSTED) return { success: true };

  try {
    await prisma.user.update({
      where: {
        id: ctx.user.id,
      },
      data: {
        trialEndsAt: null,
      },
    });

    const ownedTeams = await MembershipRepository.findAllAcceptedTeamMemberships(ctx.user.id, {
      role: "OWNER",
    });

    for (const team of ownedTeams) {
      const teamBillingService = TeamBilling.init(team);
      // In OSS mode, no trials to end - teams are always active
      log.info(`Team ${team.id} - no trial to end in OSS mode`);
    }

    return { success: true };
  } catch (error) {
    log.error("Error skipping team trials", error);
    return { success: false, error: "Failed to skip team trials" };
  }
};

export default skipTeamTrialsHandler;
