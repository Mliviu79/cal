import { getOrgFullOrigin } from "@calcom/lib/orgDomains";

export const getBookerBaseUrlSync = (
  orgSlug: string | null,
  options?: {
    protocol: boolean;
  }
) => {
  return getOrgFullOrigin(orgSlug ?? "", options);
};
