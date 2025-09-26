import { z } from "zod";

import { timeZoneSchema } from "@calcom/lib/dayjs/timeZone.schema";
import { UserPermissionRole } from "@calcom/prisma/enums";

export const ZAdminUpdateUserSchema = z.object({
  userId: z.number(),
  name: z.string().optional(),
  username: z.string().optional(),
  email: z.string().optional(),
  timeZone: timeZoneSchema.optional(),
  role: z.nativeEnum(UserPermissionRole).optional(),
});

export type TAdminUpdateUserSchema = z.infer<typeof ZAdminUpdateUserSchema>;
