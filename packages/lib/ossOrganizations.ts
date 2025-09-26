/**
 * OSS replacement for organization utilities
 * This provides basic organization functionality without EE dependencies
 */

import { prisma } from "@calcom/prisma";
import type { BillingPeriod } from "@calcom/prisma/enums";
import { MembershipRole } from "@calcom/prisma/enums";

import { OrganizationOnboardingRepository } from "@calcom/lib/server/repository/organizationOnboarding";

// Types first
export interface IUsageEvent {
  feature: string;
  userId?: number;
  data?: any;
  timestamp?: Date;
  organizationId?: number;
  teamId?: number;
  eventType?: string;
}

// Usage event constants
export const UsageEvent = {
  BOOKING: { feature: "booking" } as IUsageEvent,
  USER: { feature: "user" } as IUsageEvent,
  TEAM: { feature: "team" } as IUsageEvent,
  ORGANIZATION: { feature: "organization" } as IUsageEvent,
  EVENT_TYPE: { feature: "event_type" } as IUsageEvent,
} as const;

export type UsageEventType = typeof UsageEvent[keyof typeof UsageEvent];

// Organization utilities
export async function ensureOrganizationIsReviewed(orgId: number) {
  // In OSS mode, organizations are auto-approved
  return true;
}

export function checkPremiumUsername(username: string): boolean {
  // In OSS mode, no premium usernames
  return false;
}

// License Key Service
export class OssLicenseKeySingleton {
  static async getInstance(deploymentRepo?: any) {
    return new OssLicenseKeySingleton();
  }

  async checkLicense() {
    // In OSS mode, always return valid license
    return true;
  }

  async getUserCount() {
    return 0;
  }

  async recordUsage(event: string, data?: any) {
    // No-op in OSS mode
  }

  async incrementUsage(event?: IUsageEvent) {
    // No-op in OSS mode - just log the usage
    if (event) {
      console.log(`OSS Usage tracked: ${event.feature}`);
    }
  }
}

export const LicenseKeySingleton = OssLicenseKeySingleton;

type OrgCreationValidationOptions = {
  slug: string;
  orgOwnerId: number;
  restrictBasedOnMinimumPublishedTeams?: boolean;
  isPlatform?: boolean;
};

export type OrgCreationValidationResult = {
  slugAvailable: boolean;
  slugConflictType?: "team" | "requestedSlug" | "onboarding";
  ownerHasMinimumTeams: boolean;
};

/**
 * Minimal validation to ensure an organization can be created in OSS mode.
 * Returns structured data so callers can decide how to surface validation failures.
 */
export async function validateOrganizationCreation(
  options: OrgCreationValidationOptions
): Promise<OrgCreationValidationResult> {
  const { slug, orgOwnerId, restrictBasedOnMinimumPublishedTeams, isPlatform } = options;

  const existingTeam = await prisma.team.findFirst({
    where: {
      OR: [
        { slug },
        {
          metadata: {
            path: ["requestedSlug"],
            equals: slug,
          },
        },
      ],
    },
    select: {
      id: true,
      slug: true,
    },
  });

  let slugConflictType: OrgCreationValidationResult["slugConflictType"];
  if (existingTeam) {
    slugConflictType = existingTeam.slug === slug ? "team" : "requestedSlug";
  }

  const pendingOnboarding = !existingTeam
    ? await prisma.organizationOnboarding.findFirst({
        where: {
          slug,
          isComplete: false,
        },
        select: {
          id: true,
        },
      })
    : null;

  if (pendingOnboarding) {
    slugConflictType = "onboarding";
  }

  let ownerHasMinimumTeams = true;
  if (restrictBasedOnMinimumPublishedTeams && !isPlatform) {
    const teamCount = await prisma.membership.count({
      where: {
        userId: orgOwnerId,
        accepted: true,
        role: {
          in: [MembershipRole.ADMIN, MembershipRole.OWNER],
        },
        team: {
          parentId: null,
          isOrganization: false,
        },
      },
    });

    ownerHasMinimumTeams = teamCount > 0;
  }

  return {
    slugAvailable: !existingTeam && !pendingOnboarding,
    slugConflictType,
    ownerHasMinimumTeams,
  };
}

export async function findUserToBeOrgOwner(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });
}

type CreateOrganizationOnboardingDraftInput = {
  createdById: number;
  orgOwnerEmail: string;
  name: string;
  slug: string;
  billingPeriod: BillingPeriod;
  pricePerSeat?: number | null;
  seats?: number | null;
  invitedMembers?: { email: string; name?: string }[];
  teams?: { id: number; name: string; isBeingMigrated: boolean; slug: string | null }[];
};

export async function createOrganizationOnboardingDraft(
  input: CreateOrganizationOnboardingDraftInput
) {
  return OrganizationOnboardingRepository.create({
    createdById: input.createdById,
    billingPeriod: input.billingPeriod,
    pricePerSeat: input.pricePerSeat ?? 0,
    seats: input.seats ?? 0,
    orgOwnerEmail: input.orgOwnerEmail,
    name: input.name,
    slug: input.slug,
    invitedMembers: input.invitedMembers ?? [],
    teams: input.teams ?? [],
    logo: null,
    bio: null,
  });
}
