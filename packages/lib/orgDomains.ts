import { WEBAPP_URL, WEBSITE_URL } from "@calcom/lib/constants";

/**
 * OSS replacement for organization domain utilities
 * This provides basic organization subdomain functionality without EE dependencies
 */

export function subdomainSuffix() {
  const url = new URL(WEBAPP_URL);
  return url.hostname;
}

export function getOrgFullOrigin(slug: string | null, options: { protocol: boolean } = { protocol: true }) {
  if (!slug)
    return options.protocol ? WEBSITE_URL : WEBSITE_URL.replace("https://", "").replace("http://", "");

  const orgFullOrigin = `${
    options.protocol ? `${new URL(WEBSITE_URL).protocol}//` : ""
  }${slug}.${subdomainSuffix()}`;
  return orgFullOrigin;
}

export function getOrgSlug(hostname: string | null): string | null {
  if (!hostname) return null;
  
  const suffix = subdomainSuffix();
  if (!hostname.endsWith(suffix)) return null;
  
  const slug = hostname.replace(`.${suffix}`, "");
  return slug === suffix ? null : slug;
}

export function whereClauseForOrgWithSlugOrRequestedSlug(orgSlug: string | null) {
  if (!orgSlug) return {};
  
  return {
    OR: [
      { slug: orgSlug },
      { metadata: { path: ["requestedSlug"], equals: orgSlug } }
    ]
  };
}

export const orgDomainConfig = (subdomains: string[]) => {
  return {
    subdomains,
    domain: subdomainSuffix(),
  };
};
