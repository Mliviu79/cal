
import { type Params } from "app/_types";
import { _generateMetadata, getTranslate } from "app/_utils";
import { z } from "zod";

import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { UserRepository } from "@calcom/lib/server/repository/user";
import prisma from "@calcom/prisma";

import { AdminUserEditForm } from "../../_components/AdminUserEditForm";

const userIdSchema = z.object({ id: z.coerce.number() });

export const generateMetadata = async ({ params }: { params: Params }) => {
  const input = userIdSchema.safeParse(await params);
  if (!input.success) {
    return await _generateMetadata(
      (t) => t("editing_user"),
      (t) => t("admin_users_edit_description"),
      undefined,
      undefined,
      "/settings/admin/users/edit"
    );
  }

  const userRepo = new UserRepository(prisma);
  const user = await userRepo.adminFindById(input.data.id);

  return await _generateMetadata(
    (t) => `${t("editing_user")}: ${user.username}`,
    (t) => t("admin_users_edit_description"),
    undefined,
    undefined,
    `/settings/admin/users/${input.data.id}/edit`
  );
};

const Page = async ({ params }: { params: Params }) => {
  const input = userIdSchema.safeParse(await params);
  if (!input.success) throw new Error("Invalid access");

  const userRepo = new UserRepository(prisma);
  const user = await userRepo.adminFindById(input.data.id);
  const t = await getTranslate();

  return (
    <SettingsHeader title={t("editing_user")} description={t("admin_users_edit_description")}>
      <AdminUserEditForm user={user} />
    </SettingsHeader>
  );
};

export default Page;
