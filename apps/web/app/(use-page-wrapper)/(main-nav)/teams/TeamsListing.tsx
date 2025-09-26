"use client";

import { useState } from "react";

import type { MembershipRole } from "@calcom/prisma/enums";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Avatar } from "@calcom/ui/components/avatar";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { showToast } from "@calcom/ui/components/toast";

export type TeamListItem = {
  id: number;
  name: string;
  slug: string | null;
  logoUrl?: string | null;
  isOrganization: boolean;
  role: MembershipRole;
  accepted: boolean;
  metadata?: Record<string, unknown> | null;
};

type TeamsListingProps = {
  teams: TeamListItem[];
  isOrgAdmin: boolean;
  teamNameFromInvite: string | null;
  errorMsgFromInvite: string | null;
};

export function TeamsListing({
  teams,
  isOrgAdmin,
  teamNameFromInvite,
  errorMsgFromInvite,
}: TeamsListingProps) {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const [pendingAction, setPendingAction] = useState<{ teamId: number; accept: boolean } | null>(null);

  const acceptOrLeaveMutation = trpc.viewer.teams.acceptOrLeave.useMutation({
    onMutate: ({ teamId, accept }) => {
      setPendingAction({ teamId, accept });
    },
    async onSuccess(_data, variables) {
      const message = variables.accept
        ? t("team_invite_accepted") ?? "Invitation accepted"
        : t("team_invite_declined") ?? "Invitation declined";

      showToast(message, "success");

      await Promise.all([
        utils.viewer.teams.list.invalidate().catch(() => undefined),
        utils.viewer.teams.listMembers.invalidate().catch(() => undefined),
        utils.viewer.teams.listInvites.invalidate().catch(() => undefined),
      ]);
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
    onSettled: () => {
      setPendingAction(null);
    },
  });

  const respondToInvite = (teamId: number, accept: boolean) => {
    acceptOrLeaveMutation.mutate({ teamId, accept });
  };

  return (
    <div className="space-y-6">
      {teamNameFromInvite && (
        <div className="border-success bg-success/10 text-success rounded-xl border p-4 text-sm">
          {t("joined_team", { team: teamNameFromInvite }) ?? `You joined ${teamNameFromInvite}`}
        </div>
      )}

      {errorMsgFromInvite && (
        <div className="border-error bg-error/10 text-error rounded-xl border p-4 text-sm">
          {errorMsgFromInvite}
        </div>
      )}

      {teams.length === 0 && (
        <div className="border-subtle rounded-xl border p-8 text-center text-subtle">
          {t("no_teams_available") ?? "You do not belong to any teams yet."}
        </div>
      )}

      <ul className="space-y-3">
        {teams.map((team) => (
          <li
            key={team.id}
            className="border-subtle flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar
                alt={team.name}
                imageSrc={team.logoUrl ?? undefined}
                fallback={team.name.slice(0, 1)}
              />
              <div>
                <div className="text-default font-medium">{team.name}</div>
                {!team.accepted && (
                  <div className="text-warning text-sm">{t("pending_invitation") ?? "Pending invite"}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge>{team.role.toLowerCase()}</Badge>
              {team.accepted ? (
                <Button color="secondary" href={`/settings/teams/${team.id}/members`} shallow>
                  {isOrgAdmin ? t("manage_team") ?? "Manage" : t("view") ?? "View"}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => respondToInvite(team.id, true)}
                    loading={
                      pendingAction?.teamId === team.id && pendingAction.accept && acceptOrLeaveMutation.isPending
                    }
                    disabled={acceptOrLeaveMutation.isPending && pendingAction?.teamId === team.id}
                    color="primary">
                    {t("accept") ?? "Accept"}
                  </Button>
                  <Button
                    color="minimal"
                    onClick={() => respondToInvite(team.id, false)}
                    loading={
                      pendingAction?.teamId === team.id && !pendingAction.accept && acceptOrLeaveMutation.isPending
                    }
                    disabled={acceptOrLeaveMutation.isPending && pendingAction?.teamId === team.id}>
                    {t("decline") ?? "Decline"}
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
