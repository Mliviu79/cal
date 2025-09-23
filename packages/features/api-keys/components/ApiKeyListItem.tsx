import dayjs from "@calcom/dayjs";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import classNames from "@calcom/ui/classNames";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@calcom/ui/components/dropdown";
import { showToast } from "@calcom/ui/components/toast";
import { revalidateApiKeysList } from "@calcom/web/app/(use-page-wrapper)/settings/(settings-layout)/developer/api-keys/actions";

import type { ApiKeyListItemProps as Props } from "./types";

const getExpirationBadge = (badgeState: "expired" | "active" | "never", labelExpired: string, labelActive: string) => {
  if (badgeState === "never") {
    return <Badge variant="green">{labelActive}</Badge>;
  }

  if (badgeState === "expired") {
    return <Badge variant="red">{labelExpired}</Badge>;
  }

  return <Badge variant="green">{labelActive}</Badge>;
};

export const ApiKeyListItem = ({ apiKey, isLast, onEdit }: Props) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const expiresAt = apiKey.expiresAt ? new Date(apiKey.expiresAt) : null;
  const neverExpires = apiKey.expiresAt === null;
  const expired = expiresAt ? expiresAt.getTime() < Date.now() : false;

  const deleteApiKey = trpc.viewer.apiKeys.delete.useMutation({
    async onSuccess() {
      await utils.viewer.apiKeys.list.invalidate();
      revalidateApiKeysList();
      showToast(t("api_key_deleted"), "success");
    },
    onError(error) {
      console.error(error);
      showToast(t("something_went_wrong"), "error");
    },
  });

  const badgeState = neverExpires ? "never" : expired ? "expired" : "active";
  const badge = getExpirationBadge(badgeState, t("expired"), t("active"));
  const expiresLabel = neverExpires
    ? t("api_key_never_expires")
    : `${expired ? t("expired") : t("expires")}` +
      ` ${dayjs(apiKey.expiresAt?.toString()).fromNow()}`;

  return (
    <div
      className={classNames(
        "flex w-full items-start justify-between px-4 py-4 sm:px-6",
        isLast ? undefined : "border-subtle border-b"
      )}>
      <div className="max-w-[70%] space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-default">
            {apiKey.note?.trim() || t("api_key_no_note")}
          </p>
          {badge}
        </div>
        <p className="text-subtle text-sm">{expiresLabel}</p>
      </div>
      <Dropdown>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="icon" color="secondary" StartIcon="ellipsis" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            <DropdownItem type="button" onClick={onEdit} StartIcon="pencil">
              {t("edit") as string}
            </DropdownItem>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <DropdownItem
              type="button"
              color="destructive"
              disabled={deleteApiKey.isPending}
              onClick={() => deleteApiKey.mutate({ id: apiKey.id })}
              StartIcon="trash">
              {t("delete") as string}
            </DropdownItem>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </Dropdown>
    </div>
  );
};

export default ApiKeyListItem;
