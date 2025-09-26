"use client";

import { useMemo, useState } from "react";

import { checkAdminOrOwner } from "@calcom/features/auth/lib/checkAdminOrOwner";
import { InviteMembersButton } from "@calcom/features/teams/components/InviteMembersButton";
import type { MemberPermissions } from "@calcom/features/users/components/UserTable/types";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import type { RouterOutputs } from "@calcom/trpc/react";
import { Avatar } from "@calcom/ui/components/avatar";
import { Button } from "@calcom/ui/components/button";
import { Input } from "@calcom/ui/components/form";
import { Spinner } from "@calcom/ui/components/icon";

interface TeamMembersViewProps {
  team: NonNullable<RouterOutputs["viewer"]["teams"]["get"]>;
  facetedTeamValues?: {
    roles: { id: string; name: string }[];
    teams: RouterOutputs["viewer"]["teams"]["get"][];
    attributes: {
      id: string;
      name: string;
      options: {
        value: string;
      }[];
    }[];
  };
  attributes?: any[];
  permissions: MemberPermissions;
}

export const TeamMembersView = ({ team, permissions }: TeamMembersViewProps) => {
  const { t } = useLocale();
  const [searchTerm, setSearchTerm] = useState("");

  const isTeamAdminOrOwner = checkAdminOrOwner(team.membership.role);
  const canSeeMembers = permissions?.canListMembers ?? (!team.isPrivate || isTeamAdminOrOwner);
  const canInviteMembers = permissions?.canInvite ?? isTeamAdminOrOwner;

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = trpc.viewer.teams.listMembers.useInfiniteQuery(
    {
      teamId: team.id,
      limit: 20,
      searchTerm: searchTerm || undefined,
    },
    {
      enabled: canSeeMembers,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }
  );

  const members = useMemo(() => data?.pages.flatMap((page) => page.members) ?? [], [data]);

  if (!canSeeMembers) {
    return (
      <div className="border-subtle rounded-xl border p-6" data-testid="members-privacy-warning">
        <h2 className="text-default">{t("only_admin_can_see_members_of_team")}</h2>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={t("search_members") ?? "Search members"}
          className="sm:max-w-sm"
        />
        {canInviteMembers && (
          <InviteMembersButton
            teamId={team.id}
            teamName={team.name}
            disabled={!canInviteMembers}
            searchTerm={searchTerm || undefined}
          />
        )}
      </div>

      <div className="mt-6 space-y-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        )}

        {!isLoading && members.length === 0 && (
          <div className="border-subtle rounded-xl border p-6 text-center text-subtle">
            {t("no_members_found")}
          </div>
        )}

        {members.map((member) => (
          <div
            key={`${member.id}-${member.teamId}`}
            className="border-subtle flex items-center justify-between rounded-xl border px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar
                alt={member.name ?? member.email ?? ""}
                imageSrc={member.avatarUrl ?? undefined}
                fallback={member.name?.charAt(0) ?? member.email?.charAt(0) ?? "?"}
              />
              <div>
                <div className="text-default font-medium">
                  {member.name ?? member.email ?? t("unknown_user")}
                </div>
                <div className="text-subtle text-sm">
                  {member.email || t("pending_invitation")}
                </div>
              </div>
            </div>
            <div className="text-subtle text-sm capitalize">{member.customRole?.name ?? member.role.toLowerCase()}</div>
          </div>
        ))}

        {hasNextPage && (
          <div className="flex justify-center pt-4">
            <Button color="secondary" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
              {isFetchingNextPage ? t("loading") : t("load_more")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
