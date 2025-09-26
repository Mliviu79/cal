"use client";

/**
 * OSS replacement for organization attributes list page
 * This provides a stub implementation without EE dependencies
 */

import { useLocale } from "@calcom/lib/hooks/useLocale";

export default function OrgSettingsAttributesPage(_props?: {
  permissions: { canEdit: boolean; canDelete: boolean; canCreate: boolean };
}) {
  const { t } = useLocale();

  return (
    <div className="max-w-lg">
      <h1 className="font-cal text-xl tracking-wide text-gray-900">{t("attributes")}</h1>
      <p className="mt-4 text-sm text-gray-700">
        {t("organization_attributes_feature_not_available")}
      </p>
      <div className="mt-8 rounded-md border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          Organization attributes are an enterprise feature. In OSS mode, this functionality is not available.
        </p>
      </div>
    </div>
  );
}
