import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState, type Dispatch, type FormEvent } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { CreationSource, MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc";
import { Button } from "@calcom/ui/components/button";
import { InputError, Label, SelectField, TextArea } from "@calcom/ui/components/form";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@calcom/ui/components/dialog";
import { showToast } from "@calcom/ui/components/toast";
import usePlatformMe from "@calcom/web/components/settings/platform/hooks/usePlatformMe";

import type { UserTableAction } from "./types";

type RoleOption = {
  id: string;
  name: string;
};

interface Props {
  dispatch: Dispatch<UserTableAction>;
  roles?: RoleOption[];
}

const SPLIT_PATTERN = /[\n,;]+/;

export function InviteMemberModal({ dispatch, roles }: Props) {
  const { data: session } = useSession();
  const { data: platformUser } = usePlatformMe();
  const utils = trpc.useUtils();
  const { t, i18n } = useLocale();
  const [emailInput, setEmailInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const roleOptions = useMemo(() => {
    if (roles?.length) {
      return roles.map((role) => ({ value: role.id, label: role.name }));
    }

    return [
      { value: MembershipRole.MEMBER, label: t("member") },
      { value: MembershipRole.ADMIN, label: t("admin") },
      { value: MembershipRole.OWNER, label: t("owner") },
    ];
  }, [roles, t]);

  const [selectedRole, setSelectedRole] = useState<string>(roleOptions[0]?.value ?? MembershipRole.MEMBER);

  const membershipRoleValues = useMemo(() => new Set(Object.values(MembershipRole)), []);

  useEffect(() => {
    if (!roleOptions.length) {
      setSelectedRole(MembershipRole.MEMBER);
      return;
    }

    if (!roleOptions.find((option) => option.value === selectedRole)) {
      setSelectedRole(roleOptions[0].value);
    }
  }, [roleOptions, selectedRole]);

  const inviteMemberMutation = trpc.viewer.teams.inviteMember.useMutation({
    async onSuccess(data) {
      await utils.viewer.organizations.listMembers.invalidate();
      setEmailInput("");
      dispatch({ type: "CLOSE_MODAL" });

      if (Array.isArray(data.usernameOrEmail)) {
        showToast(
          t("email_invite_team_bulk", {
            userCount: data.numUsersInvited,
          }),
          "success"
        );
      } else {
        showToast(
          t("email_invite_team", {
            email: data.usernameOrEmail,
          }),
          "success"
        );
      }
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });

  const orgId = session?.user.org?.id ?? platformUser?.organizationId;

  if (!orgId) return null;

  const parseInput = (value: string) =>
    Array.from(
      new Set(
        value
          .split(SPLIT_PATTERN)
          .map((entry) => entry.trim())
          .filter(Boolean)
      )
    );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const entries = parseInput(emailInput);

    if (!entries.length) {
      setFormError(t("invitee_email"));
      return;
    }

    setFormError(null);

    const normalizedRole = membershipRoleValues.has(selectedRole as MembershipRole)
      ? (selectedRole as MembershipRole)
      : undefined;

    inviteMemberMutation.mutate({
      teamId: orgId,
      language: i18n.language,
      role: normalizedRole,
      usernameOrEmail: entries.length === 1 ? entries[0] : entries,
      isPlatform: platformUser?.organization.isPlatform,
      creationSource: CreationSource.WEBAPP,
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          dispatch({ type: "CLOSE_MODAL" });
        }
      }}
    >
      <DialogContent title={t("invite_new_member")} description={t("invite_via_email")} enableOverflow>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <Label htmlFor="invite-member-emails">{t("invite_via_email")}</Label>
            <TextArea
              id="invite-member-emails"
              name="emails"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder={t("invite_team_member")}
              className="mt-2"
              autoFocus
            />
            <p className="text-subtle mt-2 text-xs">
              {t("invite_team_bulk_segment")}
            </p>
            {formError && <InputError message={formError} />}
          </div>

          <div>
            <Label>{t("invite_as")}</Label>
            <SelectField
              options={roleOptions}
              value={roleOptions.find((option) => option.value === selectedRole)}
              onChange={(option) => {
                if (option) setSelectedRole(option.value);
              }}
              className="mt-2"
            />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose
              onClick={() =>
                dispatch({
                  type: "CLOSE_MODAL",
                })
              }>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" color="primary" loading={inviteMemberMutation.isPending}>
              {t("send_invite")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
