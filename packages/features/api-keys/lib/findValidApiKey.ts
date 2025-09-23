import { hashAPIKey } from "@calcom/features/api-keys/lib/apiKeys";
import prisma from "@calcom/prisma";

export const findValidApiKey = async (apiKey: string, appId?: string) => {
  const prefix = process.env.API_KEY_PREFIX ?? "cal_";
  const rawKey = apiKey.startsWith(prefix) ? apiKey.substring(prefix.length) : apiKey;
  const hashedKey = hashAPIKey(rawKey);

  return prisma.apiKey.findFirst({
    where: {
      hashedKey,
      appId,
      OR: [
        {
          expiresAt: {
            gte: new Date(),
          },
        },
        {
          expiresAt: null,
        },
      ],
    },
  });
};

export default findValidApiKey;
