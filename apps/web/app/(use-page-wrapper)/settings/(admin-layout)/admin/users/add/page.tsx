import { _generateMetadata, getTranslate } from "app/_utils";

import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("add_new_user"),
    (t) => t("admin_users_add_description"),
    undefined,
    undefined,
    "/settings/admin/users/add"
  );

const Page = async () => {
  const t = await getTranslate();

  return (
    <SettingsHeader title={t("add_new_user")} description={t("admin_users_add_description")}>
      <div className="border-subtle bg-default max-w-2xl rounded-xl border p-6 text-sm text-subtle">
        {t("platform_user_add_hint") ?? "Platform administrators can create new users through the standard sign-up or provisioning workflows."}
      </div>
    </SettingsHeader>
  );
};

export default Page;
