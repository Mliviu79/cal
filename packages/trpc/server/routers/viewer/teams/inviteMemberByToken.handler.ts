import { acceptTeamInviteByToken, TeamInviteError } from "@calcom/features/teams/lib/invitations";
import { TRPCError } from "@trpc/server";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";

import type { TInviteMemberByTokenSchemaInputSchema } from "./inviteMemberByToken.schema";

type InviteMemberByTokenOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TInviteMemberByTokenSchemaInputSchema;
};

export const inviteMemberByTokenHandler = async ({ ctx, input }: InviteMemberByTokenOptions) => {
  const { token } = input;

  try {
    return await acceptTeamInviteByToken({ token, userId: ctx.user.id });
  } catch (error) {
    if (error instanceof TeamInviteError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
    throw error;
  }
};

export default inviteMemberByTokenHandler;
