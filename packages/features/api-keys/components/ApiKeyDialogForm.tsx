import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import dayjs from "@calcom/dayjs";
import { API_NAME_LENGTH_MAX_LIMIT } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { DialogFooter } from "@calcom/ui/components/dialog";
import { Form, Switch, TextField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";
import { Tooltip } from "@calcom/ui/components/tooltip";
import { revalidateApiKeysList } from "@calcom/web/app/(use-page-wrapper)/settings/(settings-layout)/developer/api-keys/actions";

import type { ApiKey } from "./types";

const defaultExpiry = () => dayjs().add(30, "day").toDate();

type FormValues = {
  note: string;
  expiresAt: Date | null;
  neverExpires: boolean;
};

type ApiKeyDialogFormProps = {
  defaultValues?: ApiKey & { neverExpires?: boolean };
  handleClose: () => void;
};

const formatDateInput = (value: Date | null) => (value ? dayjs(value).format("YYYY-MM-DD") : "");

export const ApiKeyDialogForm = ({ defaultValues, handleClose }: ApiKeyDialogFormProps) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedConfig, setGeneratedConfig] = useState<{ expiresAt: Date | null; neverExpires: boolean } | null>(
    null
  );

  const form = useForm<FormValues>({
    defaultValues: {
      note: defaultValues?.note ?? "",
      neverExpires: defaultValues?.neverExpires ?? (defaultValues?.expiresAt === null),
      expiresAt:
        defaultValues?.expiresAt === null
          ? null
          : defaultValues?.expiresAt
            ? new Date(defaultValues.expiresAt)
            : defaultExpiry(),
    },
    mode: "onChange",
  });

  const createKey = trpc.viewer.apiKeys.create.useMutation({
    async onSuccess(prefixedKey, input) {
      setGeneratedKey(prefixedKey);
      setGeneratedConfig({ expiresAt: input.expiresAt ?? null, neverExpires: input.neverExpires ?? false });
      await utils.viewer.apiKeys.list.invalidate();
      revalidateApiKeysList();
    },
    onError() {
      showToast(t("something_went_wrong"), "error");
    },
  });

  const updateKey = trpc.viewer.apiKeys.edit.useMutation({
    async onSuccess() {
      await utils.viewer.apiKeys.list.invalidate();
      revalidateApiKeysList();
      showToast(t("api_key_updated"), "success");
      handleClose();
    },
    onError() {
      showToast(t("api_key_update_failed"), "error");
    },
  });

  const submit = async (values: FormValues) => {
    if (values.note.trim().length > API_NAME_LENGTH_MAX_LIMIT) {
      showToast(t("api_key_name_too_long", { max: API_NAME_LENGTH_MAX_LIMIT }), "error");
      return;
    }

    const payload = {
      note: values.note.trim() || undefined,
      neverExpires: values.neverExpires,
      expiresAt: values.neverExpires ? null : values.expiresAt,
    };

    if (defaultValues) {
      updateKey.mutate({ 
        id: defaultValues.id, 
        note: payload.note,
        expiresAt: payload.expiresAt || undefined,
      });
      return;
    }

    createKey.mutate(payload);
  };

  if (generatedKey) {
    const expiryLabel = generatedConfig?.neverExpires
      ? t("api_key_never_expires")
      : generatedConfig?.expiresAt
        ? generatedConfig.expiresAt.toLocaleDateString()
        : "";

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-cal text-emphasis mb-2 text-xl tracking-wide">{t("success_api_key_created")}</h2>
          <p className="text-subtle text-sm">{t("you_will_only_view_it_once")}</p>
        </div>
        <div>
          <div className="flex">
            <code className="bg-subtle text-default w-full truncate rounded-md rounded-r-none py-1.5 pl-3 pr-2 font-mono text-sm">
              {generatedKey}
            </code>
            <Tooltip side="top" content={t("copy_to_clipboard")}>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey);
                  showToast(t("api_key_copied"), "success");
                }}
                type="button"
                className="rounded-l-none"
                StartIcon="clipboard">
                {t("copy")}
              </Button>
            </Tooltip>
          </div>
          <p className="text-subtle mt-2 text-sm">{expiryLabel}</p>
        </div>
        <DialogFooter showDivider>
          <Button type="button" color="secondary" onClick={handleClose}>
            {t("done")}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const neverExpires = form.watch("neverExpires");

  return (
    <Form form={form} handleSubmit={submit} className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-cal text-emphasis text-xl tracking-wide">
          {defaultValues ? t("edit_api_key") : t("create_api_key")}
        </h2>
        <p className="text-subtle text-sm">{t("api_key_modal_subtitle")}</p>
      </div>

      <Controller
        name="note"
        control={form.control}
        render={({ field }) => (
          <TextField
            {...field}
            label={t("personal_note")}
            placeholder={t("personal_note_placeholder")}
            value={field.value}
            onChange={(event) => field.onChange(event.target.value)}
          />
        )}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-default text-sm font-medium">{t("api_key_never_expires")}</span>
          <Controller
            name="neverExpires"
            control={form.control}
            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
          />
        </div>

        {!neverExpires && (
          <Controller
            name="expiresAt"
            control={form.control}
            render={({ field }) => (
              <TextField
                label={t("expire_date")}
                type="date"
                value={formatDateInput(field.value)}
                onChange={(event) => {
                  const next = event.target.value ? dayjs(event.target.value).endOf("day").toDate() : null;
                  field.onChange(next);
                }}
                min={dayjs().format("YYYY-MM-DD")}
              />
            )}
          />
        )}
      </div>

      <DialogFooter showDivider>
        <Button type="button" color="secondary" onClick={handleClose}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={createKey.isPending || updateKey.isPending}>
          {defaultValues ? t("save") : t("create")}
        </Button>
      </DialogFooter>
    </Form>
  );
};

export default ApiKeyDialogForm;
