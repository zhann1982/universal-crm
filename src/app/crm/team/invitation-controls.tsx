"use client";
import { OrganizationForm } from "@/modules/access/organization-context";
import { useToastActionState } from "@/modules/notifications/use-toast-action-state";
import { manageInvitation, type InviteMemberState } from "./actions";
export function InvitationControls({
  id,
  expiresAt,
}: {
  id: string;
  expiresAt: string;
}) {
  const [state, action, pending] = useToastActionState(manageInvitation, {
    status: "idle",
  } as InviteMemberState);
  return (
    <div>
      <OrganizationForm action={action} className="mt-2 flex gap-2">
        <input type="hidden" name="invitationId" value={id} />
        <input type="hidden" name="expectedExpiresAt" value={expiresAt} />
        <button
          disabled={pending}
          name="operation"
          value="reissue"
          className="rounded border px-3 py-2 text-sm disabled:opacity-50"
        >
          Перевыпустить ссылку
        </button>
        <button
          disabled={pending}
          name="operation"
          value="revoke"
          className="rounded border px-3 py-2 text-sm text-red-700 disabled:opacity-50"
        >
          Отозвать
        </button>
      </OrganizationForm>
      {state.status === "error" && (
        <p className="mt-2 text-sm text-red-700">{state.message}</p>
      )}
      {state.status === "revoked" && (
        <p className="mt-2 text-sm text-green-700">Приглашение отозвано.</p>
      )}
      {state.status === "created" && (
        <div className="mt-2 text-sm">
          <p>
            {state.delivery === "accepted"
              ? "Почтовый сервис принял письмо к отправке."
              : state.delivery === "failed"
                ? "Отправка письма не подтверждена. Передайте новую ссылку вручную."
                : "Почта не подключена. Передайте новую ссылку вручную."}
          </p>
          <div className="mt-2 break-all rounded bg-slate-50 p-3">
            {state.link ?? state.token}
          </div>
        </div>
      )}
    </div>
  );
}
