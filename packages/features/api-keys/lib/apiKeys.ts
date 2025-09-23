import { createHash, randomBytes } from "crypto";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export const hashAPIKey = (apiKey: string): string => digest(apiKey);

export const generateUniqueAPIKey = (seed?: string): [string, string] => {
  const rawKey = seed ?? randomBytes(16).toString("hex");
  return [hashAPIKey(rawKey), rawKey];
};
