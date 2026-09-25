import {
  and,
  asc,
  eq,
} from "drizzle-orm";

import { db } from "@/db";
import {
  memberRoles,
  organizationMembers,
  roles,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";

import { AddMemberForm } from "./add-member-form";
import { updateMemberRoles } from "./actions";

type SearchParams = {
  saved?: string;
  added?: string;
  error?: string;
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params =
    await searchParams;

  const {
    organization,
    member: currentMember,
    permissions: currentPermissions,
  } = await requirePermission(
    "members.read",
  );

  const rows = await db
    .select({
      memberId:
        organizationMembers.id,

      userId:
        organizationMembers.userId,

      displayName:
        organizationMembers.displayName,

      email:
        organizationMembers.email,

      status:
        organizationMembers.status,

      joinedAt:
        organizationMembers.joinedAt,

      roleId:
        roles.id,

      roleName:
        roles.name,
    })
    .from(organizationMembers)
    .leftJoin(
      memberRoles,
      eq(
        memberRoles.memberId,
        organizationMembers.id,
      ),
    )
    .leftJoin(
      roles,
      and(
        eq(
          roles.id,
          memberRoles.roleId,
        ),

        eq(
          roles.organizationId,
          organization.id,
        ),
      ),
    )
    .where(
      eq(
        organizationMembers.organizationId,
        organization.id,
      ),
    )
    .orderBy(
      asc(
        organizationMembers.displayName,
      ),
    );

  const roleList = await db
    .select({
      id: roles.id,
      name: roles.name,
      description:
        roles.description,
    })
    .from(roles)
    .where(
      eq(
        roles.organizationId,
        organization.id,
      ),
    )
    .orderBy(
      asc(roles.name),
    );

  const memberMap =
    new Map<
      string,
      {
        id: string;
        userId: string;

        displayName:
          | string
          | null;

        email:
          | string
          | null;

        status: string;

        joinedAt: Date;

        roles: Array<{
          id: string;
          name: string;
        }>;
      }
    >();

  for (const row of rows) {
    let member =
      memberMap.get(
        row.memberId,
      );

    if (!member) {
      member = {
        id: row.memberId,

        userId:
          row.userId,

        displayName:
          row.displayName,

        email:
          row.email,

        status:
          row.status,

        joinedAt:
          row.joinedAt,

        roles: [],
      };

      memberMap.set(
        row.memberId,
        member,
      );
    }

    if (
      row.roleId &&
      row.roleName
    ) {
      member.roles.push({
        id: row.roleId,
        name: row.roleName,
      });
    }
  }

  const members = [
    ...memberMap.values(),
  ];

  const canManage =
    currentPermissions.has(
      "members.manage",
    );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Команда
        </h1>

        <p className="mt-2 text-slate-500">
          Сотрудники и роли организации.
        </p>
      </div>

      {params.saved === "1" && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Роли сотрудника обновлены.
        </div>
      )}

      {params.added === "1" && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Сотрудник добавлен в организацию.
        </div>
      )}

      {params.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(
            params.error,
          )}
        </div>
      )}

      {canManage && (
        <AddMemberForm
          roles={roleList}
        />
      )}

      <div className="grid gap-5">
        {members.map(
          (member) => {
            const isCurrent =
              member.id ===
              currentMember.id;

            const selectedRoleIds =
              new Set(
                member.roles.map(
                  (role) =>
                    role.id,
                ),
              );

            return (
              <section
                key={member.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold">
                        {member.displayName ||
                          member.userId}
                      </h2>

                      {isCurrent && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                          Вы
                        </span>
                      )}

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">
                        {member.status}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-slate-500">
                      {member.email ||
                        "Email не указан"}
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      userId:{" "}
                      {member.userId}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {member.roles.length >
                      0 ? (
                        member.roles.map(
                          (role) => (
                            <span
                              key={
                                role.id
                              }
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium"
                            >
                              {
                                role.name
                              }
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-sm text-slate-400">
                          Роли не назначены
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-slate-400">
                    В команде с{" "}
                    {member.joinedAt.toLocaleDateString(
                      "ru-RU",
                    )}
                  </div>
                </div>

                {canManage &&
                  !isCurrent && (
                    <form
                      action={
                        updateMemberRoles
                      }
                      className="mt-6 border-t border-slate-200 pt-5"
                    >
                      <input
                        type="hidden"
                        name="memberId"
                        value={
                          member.id
                        }
                      />

                      <div className="text-sm font-medium">
                        Роли сотрудника
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3">
                        {roleList.map(
                          (role) => (
                            <label
                              key={
                                role.id
                              }
                              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                name="roleIds"
                                value={
                                  role.id
                                }
                                defaultChecked={selectedRoleIds.has(
                                  role.id,
                                )}
                              />

                              <span>
                                {
                                  role.name
                                }
                              </span>
                            </label>
                          ),
                        )}
                      </div>

                      <button
                        type="submit"
                        className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        Сохранить роли
                      </button>
                    </form>
                  )}

                {canManage &&
                  isCurrent && (
                    <div className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-500">
                      Изменение собственных
                      ролей временно запрещено,
                      чтобы не потерять
                      административный доступ.
                    </div>
                  )}
              </section>
            );
          },
        )}
      </div>
    </div>
  );
}

function getErrorMessage(
  error: string,
) {
  switch (error) {
    case "self":
      return "Нельзя изменять собственные роли.";

    case "member":
      return "Сотрудник не найден.";

    case "role":
      return "Одна из выбранных ролей недоступна.";

    case "invalid":
      return "Выберите хотя бы одну корректную роль.";

    case "add-invalid":
      return "Проверьте email и выбранную роль.";

    case "user-not-found":
      return "Пользователь с таким email ещё не зарегистрирован.";

    case "member-exists":
      return "Этот пользователь уже состоит в организации.";

    default:
      return "Не удалось выполнить операцию.";
  }
}