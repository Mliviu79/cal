import { z } from "zod";

import { MAX_NB_INVITES } from "@calcom/lib/constants";
import { emailSchema } from "@calcom/lib/emailSchema";
import { MembershipRole } from "@calcom/prisma/enums";
import { CreationSource } from "@calcom/prisma/enums";

const normalizeIdentifier = (value: string) => value.trim().toLowerCase();

export const ZInviteMemberInputSchema = z.object({
  teamId: z.number(),
  usernameOrEmail: z
    .union([
      z.string(),
      z
        .union([
          z.string(),
          z.object({
            email: emailSchema,
            role: z.nativeEnum(MembershipRole),
          }),
        ])
        .array(),
    ])
    .transform((usernameOrEmail) => {
      if (typeof usernameOrEmail === "string") {
        return normalizeIdentifier(usernameOrEmail);
      }
      return usernameOrEmail.map((item) => {
        if (typeof item === "string") {
          return normalizeIdentifier(item);
        }

        return {
          ...item,
          email: normalizeIdentifier(item.email),
        };
      });
    })
    .superRefine((value, ctx) => {
      const asArray = Array.isArray(value) ? value : [value];

      if (Array.isArray(value) && value.length > MAX_NB_INVITES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `You are limited to inviting a maximum of ${MAX_NB_INVITES} users at once.`,
        });
      }

      const hasInvalidStringEmail = asArray.some(
        (entry) => typeof entry === "string" && entry.includes("@") && !emailSchema.safeParse(entry).success
      );
      if (hasInvalidStringEmail) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide valid email addresses or usernames for each invitation.",
        });
      }

      const hasEmptyIdentifier = asArray.some((entry) => typeof entry === "string" && entry.length === 0);
      if (hasEmptyIdentifier) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invitation entries cannot be empty.",
        });
      }
    }),
  role: z.nativeEnum(MembershipRole).optional(),
  language: z.string(),
  isPlatform: z.boolean().optional(),
  creationSource: z.nativeEnum(CreationSource),
});

export type TInviteMemberInputSchema = z.infer<typeof ZInviteMemberInputSchema>;
