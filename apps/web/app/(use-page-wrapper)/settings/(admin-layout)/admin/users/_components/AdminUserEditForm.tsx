
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { TimezoneSelect } from "@calcom/features/components/timezone-select";
import { timeZoneSchema } from "@calcom/lib/dayjs/timeZone.schema";
import { emailSchema } from "@calcom/lib/emailSchema";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { UserPermissionRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { Form, InputField, SelectField, Label } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";

const formSchema = z.object({
  name: z.string().optional(),
  username: z.string().min(1),
  email: emailSchema,
  timeZone: timeZoneSchema,
  role: z.nativeEnum(UserPermissionRole),
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  user: {
    id: number;
    name: string | null;
    username: string | null;
    email: string | null;
    timeZone: string | null;
    role: UserPermissionRole;
    locked: boolean;
  };
};

export function AdminUserEditForm({ user }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const utils = trpc.useUtils();

  const allowedRoles = useMemo(() => Object.values(UserPermissionRole), []);
  const defaultRole = allowedRoles.includes(user.role as UserPermissionRole)
    ? (user.role as UserPermissionRole)
    : UserPermissionRole.USER;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user.name ?? "",
      username: user.username ?? "",
      email: user.email ?? "",
      timeZone: user.timeZone ?? "UTC",
      role: defaultRole,
    },
  });

  const roleOptions = useMemo(
    () =>
      allowedRoles.map((role) => ({
        value: role,
        label: role,
      })),
    [allowedRoles]
  );
  const mutation = trpc.viewer.admin.updateUser.useMutation({
    onSuccess: () => {
      showToast(t("user_updated") ?? "User updated", "success");
      utils.viewer.admin.listPaginated.invalidate();
      router.refresh();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  return (
    <Form
      form={form}
      className="border-subtle bg-default max-w-2xl space-y-4 rounded-xl border p-6"
      handleSubmit={(values) => {
        mutation.mutate({
          userId: user.id,
          name: values.name,
          username: values.username,
          email: values.email,
          timeZone: values.timeZone,
          role: values.role,
        });
      }}>
      <div className="grid gap-4 md:grid-cols-2">
        <InputField label={t("name") ?? "Name"} {...form.register("name")} />
        <InputField label={t("username") ?? "Username"} {...form.register("username")} />
      </div>
      <InputField label={t("email") ?? "Email"} {...form.register("email")} />
      <div className="grid gap-4 md:grid-cols-2">
        <Controller
          control={form.control}
          name="timeZone"
          render={({ field }) => (
            <>
              <Label>{t("timezone") ?? "Timezone"}</Label>
              <TimezoneSelect
                value={field.value}
                onChange={(value) => field.onChange(value)}
              />
            </>
          )}
        />
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <SelectField
              label={t("role") ?? "Role"}
              options={roleOptions}
              value={roleOptions.find((option) => option.value === field.value) ?? null}
              onChange={(option) => option && field.onChange(option.value)}
            />
          )}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" color="secondary" onClick={() => router.push("/settings/admin/users")}>
          {t("cancel") ?? "Cancel"}
        </Button>
        <Button type="submit" color="primary" loading={mutation.isPending}>
          {t("save") ?? "Save"}
        </Button>
      </div>
    </Form>
  );
}
