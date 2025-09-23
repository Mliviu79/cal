import type { RouterOutputs } from "@calcom/trpc/react";

export type ApiKey = RouterOutputs["viewer"]["apiKeys"]["list"][number];

export type ApiKeyListItemProps = {
  apiKey: ApiKey;
  isLast: boolean;
  onEdit: () => void;
};
