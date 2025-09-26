"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { CreationSource, MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@calcom/ui/components/dialog";
import { InputError, Label, SelectField, TextArea } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";

const SPLIT_PATTERN = /[\n,;]+/;

type RoleOption = {
  value: string;
  label: string;
};

function normalizeRecipient(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

type InviteMembersButtonProps = {
  teamId: number;
  teamName: string;
  disabled?: boolean;
  searchTerm?: string;
};

type InviteMemberResult = {
  usernameOrEmail: string | string[];
  numUsersInvited: number;
};

export function InviteMembersButton({ teamId, teamName, disabled, searchTerm }: InviteMembersButtonProps) {
  const { t, i18n } = useLocale();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>(MembershipRole.MEMBER);

  const membershipRoleValues = useMemo(() => new Set(Object.values(MembershipRole)), []);

  const { data: customRoles } = trpc.viewer.pbac.getTeamRoles.useQuery(
    { teamId },
    {
      enabled: open,
    }
  );

  const roleOptions = useMemo<RoleOption[]>(() => {
    if (customRoles && customRoles.length) {
      return customRoles.map((role) => ({ value: role.id, label: role.name }));
    }

    return [
      { value: MembershipRole.MEMBER, label: t("member") ?? "Member" },
      { value: MembershipRole.ADMIN, label: t("admin") ?? "Admin" },
      { value: MembershipRole.OWNER, label: t("owner") ?? "Owner" },
    ];
  }, [customRoles, t]);

  useEffect(() => {
    if (!roleOptions.length) return;
    const hasSelectedRole = roleOptions.some((option) => option.value === selectedRole);
    if (!hasSelectedRole) {
      setSelectedRole(roleOptions[0].value);
    }
  }, [roleOptions, selectedRole]);

  const parseRecipients = (value: string) =>
    Array.from(
      new Set(
        value
          .split(SPLIT_PATTERN)
          .map(normalizeRecipient)
          .filter((entry): entry is string => Boolean(entry))
      )
    );

  const resetForm = () => {
    setEmailInput("");
    setFormError(null);
  };

  const invalidateMembersList = async () => {
    await utils.viewer.teams.listMembers.invalidate({
      teamId,
      limit: 20,
      searchTerm: searchTerm || undefined,
    });
  };

  const inviteMemberMutation = trpc.viewer.teams.inviteMember.useMutation({
    async onSuccess(data: InviteMemberResult) {
      await invalidateMembersList();
      resetForm();
      setOpen(false);

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const recipients = parseRecipients(emailInput);

    if (!recipients.length) {
      setFormError(t("invitee_email") ?? "Enter at least one email address or username");
      return;
    }

    setFormError(null);

    const normalizedRole = membershipRoleValues.has(selectedRole as MembershipRole)
      ? (selectedRole as MembershipRole)
      : undefined;

    inviteMemberMutation.mutate({
      teamId,
      language: i18n.language,
      role: normalizedRole,
      usernameOrEmail: recipients.length === 1 ? recipients[0] : recipients,
      creationSource: CreationSource.WEBAPP,
    });
  };

  return (
    <>
      <Button
        color="primary"
        onClick={() => setOpen(true)}
        disabled={disabled}
        data-testid="invite-team-members">
        {t("invite_new_member") ?? "Invite members"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && inviteMemberMutation.isPending) return;
          setOpen(nextOpen);
          if (!nextOpen) {
            resetForm();
          }
        }}>
        <DialogContent
          title={t("invite_new_member") ?? `Invite to ${teamName}`}
          description={t("invite_via_email") ?? "Send invitations by email"}
          enableOverflow
          preventCloseOnOutsideClick={inviteMemberMutation.isPending}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <Label htmlFor="team-invite-emails">{t("invite_via_email") ?? "Email addresses"}</Label>
              <TextArea
                id="team-invite-emails"
                name="emails"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder={t("invite_team_member") ?? "Email or username"}
                className="mt-2"
                autoFocus
              />
              <p className="text-subtle mt-2 text-xs">
                {t("invite_team_bulk_segment") ?? "Separate addresses with commas or new lines."}
              </p>
              {formError && <InputError message={formError} />}
            </div>

            <div>
              <Label>{t("invite_as") ?? "Invite as"}</Label>
              <SelectField
                className="mt-2"
                options={roleOptions}
                value={roleOptions.find((option) => option.value === selectedRole)}
                onChange={(option) => {
                  if (option) setSelectedRole(option.value);
                }}
              />
            </div>

            <DialogFooter className="gap-2">
              <DialogClose
                onClick={() => {
                  resetForm();
                }}
                disabled={inviteMemberMutation.isPending}>
                {t("cancel")}
              </DialogClose>
              <Button type="submit" color="primary" loading={inviteMemberMutation.isPending}>
                {t("send_invite") ?? "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
