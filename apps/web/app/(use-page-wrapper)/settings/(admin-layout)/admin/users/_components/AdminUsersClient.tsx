"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useDebounce } from "@calcom/lib/hooks/useDebounce";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc, type RouterOutputs } from "@calcom/trpc/react";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { Dropdown, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@calcom/ui/components/dropdown";
import { Input } from "@calcom/ui/components/form";
import { Spinner } from "@calcom/ui/components/icon";
import { showToast } from "@calcom/ui/components/toast";

const PAGE_SIZE = 25;

const buildQueryInput = (searchTerm: string | null) => ({
  limit: PAGE_SIZE,
  searchTerm,
});

type AdminUserRow = RouterOutputs["viewer"]["admin"]["listPaginated"]["rows"][number];

type RowUpdater = (row: AdminUserRow) => AdminUserRow;

export default function AdminUsersClient() {
  const router = useRouter();
  const { t } = useLocale();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const normalizedSearch = debouncedSearch.trim();
  const searchFilter = normalizedSearch.length > 0 ? normalizedSearch : null;

  const utils = trpc.useUtils();

  const listQuery = trpc.viewer.admin.listPaginated.useInfiniteQuery(buildQueryInput(searchFilter), {
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => listQuery.data?.pages.flatMap((page) => page.rows) ?? [], [listQuery.data]);
  const total = listQuery.data?.pages?.[0]?.meta?.totalRowCount ?? 0;
  const error = listQuery.error;

  const [lockingUserId, setLockingUserId] = useState<number | null>(null);
  const [passwordResetUserId, setPasswordResetUserId] = useState<number | null>(null);
  const [twoFactorUserId, setTwoFactorUserId] = useState<number | null>(null);

  const updateCachedRow = (userId: number, updater: RowUpdater) => {
    utils.viewer.admin.listPaginated.setInfiniteData(buildQueryInput(searchFilter), (data) => {
      if (!data) return data;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          rows: page.rows.map((row) => (row.id === userId ? updater(row) : row)),
        })),
      };
    });
  };

  const lockMutation = trpc.viewer.admin.lockUserAccount.useMutation({
    onMutate: ({ userId }) => setLockingUserId(userId),
    onSuccess: ({ userId, locked }) => {
      updateCachedRow(userId, (row) => ({ ...row, locked }));
      showToast(locked ? t("user_locked") ?? "User locked" : t("user_unlocked") ?? "User unlocked", "success");
    },
    onError: (error) => showToast(error.message, "error"),
    onSettled: () => setLockingUserId(null),
  });

  const passwordResetMutation = trpc.viewer.admin.sendPasswordReset.useMutation({
    onMutate: ({ userId }) => setPasswordResetUserId(userId),
    onSuccess: () => {
      showToast(t("password_reset_email_sent") ?? "Password reset email sent", "success");
    },
    onError: (error) => showToast(error.message, "error"),
    onSettled: () => setPasswordResetUserId(null),
  });

  const removeTwoFactorMutation = trpc.viewer.admin.removeTwoFactor.useMutation({
    onMutate: ({ userId }) => setTwoFactorUserId(userId),
    onSuccess: () => {
      showToast(t("two_factor_removed") ?? "Two-factor authentication removed", "success");
    },
    onError: (error) => showToast(error.message, "error"),
    onSettled: () => setTwoFactorUserId(null),
  });

  const handleLockToggle = (user: AdminUserRow) => {
    lockMutation.mutate({ userId: user.id, locked: !user.locked });
  };

  const handlePasswordReset = (user: AdminUserRow) => {
    passwordResetMutation.mutate({ userId: user.id });
  };

  const handleRemoveTwoFactor = (user: AdminUserRow) => {
    removeTwoFactorMutation.mutate({ userId: user.id });
  };

  const handleEdit = (user: AdminUserRow) => {
    router.push(`/settings/admin/users/${user.id}/edit`);
  };

  const loading = listQuery.isLoading;
  const emptyState = !loading && rows.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:max-w-xs">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t("search_users_placeholder") ?? "Search users"}
          />
        </div>
        <div className="text-subtle text-sm">
          {t("total_users_count", { count: total }) ?? `Total users: ${total}`}
        </div>
      </div>

      {error ? (
        <div className="border-destructive/40 text-destructive bg-destructive/10 rounded-xl border p-6 text-sm">
          {error.message}
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : emptyState ? (
        <div className="border-subtle bg-default rounded-xl border p-6 text-center text-subtle">
          {t("no_users_found") ?? "No users found"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-subtle">
            <thead className="bg-muted">
              <tr className="text-left text-sm font-semibold text-subtle uppercase tracking-wide">
                <th className="px-4 py-3">{t("user") ?? "User"}</th>
                <th className="px-4 py-3">{t("email") ?? "Email"}</th>
                <th className="px-4 py-3">{t("timezone") ?? "Timezone"}</th>
                <th className="px-4 py-3">{t("status") ?? "Status"}</th>
                <th className="px-4 py-3">{t("actions") ?? "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle bg-default text-sm">
              {rows.map((user) => {
                const displayName = user.name || user.username || user.email;
                const profileUsernames = user.profiles?.map((profile) => profile.username).filter(Boolean) ?? [];

                const isLocking = lockingUserId === user.id;
                const isResetting = passwordResetUserId === user.id;
                const isRemovingTwoFactor = twoFactorUserId === user.id;

                return (
                  <tr key={user.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-default">{displayName}</div>
                      <div className="text-subtle text-xs">{profileUsernames.join(", ")}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-default">{user.email ?? "-"}</td>
                    <td className="px-4 py-3 align-top text-default">{user.timeZone ?? "-"}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge color={user.locked ? "destructive" : "secondary"}>
                          {user.locked ? t("locked") ?? "Locked" : t("active") ?? "Active"}
                        </Badge>
                        <Badge color="secondary">{user.role}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Dropdown>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" color="secondary">
                            {t("actions") ?? "Actions"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[200px]">
                          <DropdownMenuItem onSelect={() => handleEdit(user)}>
                            {t("view_edit_user") ?? "View / Edit"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isResetting}
                            onSelect={() => handlePasswordReset(user)}>
                            {isResetting ? t("loading") ?? "Loading..." : t("send_password_reset") ?? "Send reset email"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isRemovingTwoFactor}
                            onSelect={() => handleRemoveTwoFactor(user)}>
                            {isRemovingTwoFactor
                              ? t("loading") ?? "Loading..."
                              : t("remove_two_factor") ?? "Remove 2FA"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isLocking}
                            onSelect={() => handleLockToggle(user)}>
                            {isLocking
                              ? t("loading") ?? "Loading..."
                              : user.locked
                              ? t("unlock_user") ?? "Unlock user"
                              : t("lock_user") ?? "Lock user"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {listQuery.hasNextPage && (
        <div className="flex justify-center">
          <Button
            color="secondary"
            onClick={() => listQuery.fetchNextPage()}
            loading={listQuery.isFetchingNextPage}
          >
            {t("load_more") ?? "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
