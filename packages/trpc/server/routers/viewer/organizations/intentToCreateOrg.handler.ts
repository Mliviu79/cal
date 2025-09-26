import {
  LicenseKeySingleton,
  findUserToBeOrgOwner,
  validateOrganizationCreation,
  createOrganizationOnboardingDraft,
} from "@calcom/lib/ossOrganizations";
import { IS_SELF_HOSTED } from "@calcom/lib/constants";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import { DeploymentRepository } from "@calcom/lib/server/repository/deployment";
import { OrganizationOnboardingRepository } from "@calcom/lib/server/repository/organizationOnboarding";
import { prisma } from "@calcom/prisma";
import { UserPermissionRole, BillingPeriod as PrismaBillingPeriod } from "@calcom/prisma/enums";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../types";
import type { TIntentToCreateOrgInputSchema } from "./intentToCreateOrg.schema";

const log = logger.getSubLogger({ prefix: ["intentToCreateOrgHandler"] });

type CreateOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TIntentToCreateOrgInputSchema;
};

export const intentToCreateOrgHandler = async ({ input, ctx }: CreateOptions) => {
  const { slug, name, orgOwnerEmail, seats, pricePerSeat, billingPeriod, isPlatform } = input;
  log.debug(
    "Starting organization creation intent",
    safeStringify({ slug, name, orgOwnerEmail, isPlatform })
  );

  if (IS_SELF_HOSTED) {
    const deploymentRepo = new DeploymentRepository(prisma);
    const licenseKeyService = await LicenseKeySingleton.getInstance(deploymentRepo);
    const hasValidLicense = await licenseKeyService.checkLicense();

    if (!hasValidLicense) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        // TODO: We need to send translation keys from here and frontend should translate it
        message: "License is not valid",
      });
    }
  }

  const loggedInUser = ctx.user;
  if (!loggedInUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "You are not authorized." });

  const IS_USER_ADMIN = loggedInUser.role === UserPermissionRole.ADMIN;
  log.debug("User authorization check", safeStringify({ userId: loggedInUser.id, isAdmin: IS_USER_ADMIN }));

  if (!IS_USER_ADMIN && loggedInUser.email !== orgOwnerEmail && !isPlatform) {
    log.warn(
      "Unauthorized organization creation attempt",
      safeStringify({ loggedInUserEmail: loggedInUser.email, orgOwnerEmail })
    );
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only create organization where you are the owner",
    });
  }

  const orgOwner = await findUserToBeOrgOwner(orgOwnerEmail);
  if (!orgOwner) {
    // The flow exists to create the user through the stripe webhook invoice.paid but there could be a possible security issue with the approach. So, we avoid it currently.
    // Issue: As the onboarding link(which has onboardingId) could be used by unwanted person to pay and then invite some unwanted members to the organization.
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `No user found with email ${orgOwnerEmail}`,
    });
  }
  log.debug("Found organization owner", safeStringify({ orgOwnerId: orgOwner.id, email: orgOwner.email }));

  let organizationOnboarding = await OrganizationOnboardingRepository.findByOrgOwnerEmail(orgOwner.email);
  if (organizationOnboarding) {
    throw new Error("organization_onboarding_already_exists");
  }

  const validation = await validateOrganizationCreation({
    slug,
    orgOwnerId: orgOwner.id,
    restrictBasedOnMinimumPublishedTeams: !IS_USER_ADMIN,
    isPlatform,
  });

  if (!validation.slugAvailable) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        validation.slugConflictType === "onboarding"
          ? "organization_onboarding_already_exists"
          : "organization_slug_taken",
    });
  }

  if (!validation.ownerHasMinimumTeams) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "not_authorized",
    });
  }

  const billingPeriodValue = (input.billingPeriod || PrismaBillingPeriod.MONTHLY) as PrismaBillingPeriod;
  const pricePerSeatValue = input.pricePerSeat ?? 0;
  const seatsValue = input.seats ?? 0;

  organizationOnboarding = await createOrganizationOnboardingDraft({
    createdById: loggedInUser.id,
    orgOwnerEmail: orgOwner.email,
    name,
    slug,
    billingPeriod: billingPeriodValue,
    pricePerSeat: pricePerSeatValue,
    seats: seatsValue,
  });

  log.debug("Organization creation intent successful", safeStringify({ slug, orgOwnerId: orgOwner.id }));
  return {
    userId: orgOwner.id,
    orgOwnerEmail,
    name,
    slug,
    seats,
    pricePerSeat,
    billingPeriod,
    isPlatform,
    organizationOnboardingId: organizationOnboarding.id,
  };
};

export default intentToCreateOrgHandler;
