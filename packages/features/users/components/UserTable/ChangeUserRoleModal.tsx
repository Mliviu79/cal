import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState, type Dispatch } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc";
import { Button } from "@calcom/ui/components/button";
import { SelectField } from "@calcom/ui/components/form";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@calcom/ui/components/dialog";
import { showToast } from "@calcom/ui/components/toast";

import type { UserTableAction, UserTableState } from "./types";

type RoleOption = {
  id: string;
  name: string;
};

export function ChangeUserRoleModal({ state, dispatch, roles }: {
  state: UserTableState;
  dispatch: Dispatch<UserTableAction>;
  roles?: RoleOption[];
}) {
  const { data: session } = useSession();
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const orgId = session?.user.org?.id;
  const member = state.changeMemberRole.user;

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

  const determineInitialRole = () => {
    if (!member) return roleOptions[0]?.value ?? MembershipRole.MEMBER;

    if (member.customRole?.id) return member.customRole.id;
    if (member.role) return member.role;

    return roleOptions[0]?.value ?? MembershipRole.MEMBER;
  };

  const [selectedRole, setSelectedRole] = useState<string>(determineInitialRole());

  useEffect(() => {
    if (!roleOptions.length) {
      setSelectedRole(MembershipRole.MEMBER);
      return;
    }

    const currentRoleId = member?.customRole?.id ?? member?.role;

    if (currentRoleId && roleOptions.find((item) => item.value === currentRoleId)) {
      if (currentRoleId !== selectedRole) {
        setSelectedRole(currentRoleId);
      }
      return;
    }

    if (!roleOptions.find((item) => item.value === selectedRole)) {
      setSelectedRole(roleOptions[0].value);
    }
  }, [member?.customRole?.id, member?.role, roleOptions, selectedRole]);

  const changeMemberRoleMutation = trpc.viewer.teams.changeMemberRole.useMutation({
    async onSuccess() {
      await utils.viewer.organizations.listMembers.invalidate();
      showToast(t("success"), "success");
      dispatch({ type: "CLOSE_MODAL" });
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });

  if (!orgId || !member) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          dispatch({ type: "CLOSE_MODAL" });
        }
      }}
    >
      <DialogContent title={t("change_member_role")} enableOverflow>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            changeMemberRoleMutation.mutate({
              teamId: orgId,
              memberId: member.id,
              role: selectedRole,
            });
          }}
        >
          <SelectField
            label={t("role")}
            options={roleOptions}
            value={roleOptions.find((option) => option.value === selectedRole)}
            onChange={(option) => {
              if (option) setSelectedRole(option.value);
            }}
          />

          <DialogFooter className="gap-2">
            <DialogClose onClick={() => dispatch({ type: "CLOSE_MODAL" })}>{t("cancel")}</DialogClose>
            <Button type="submit" color="primary" loading={changeMemberRoleMutation.isPending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
