import {
  and,
  asc,
  eq,
  isNull,
} from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import {
  clientCompanies,
  clients,
} from "@/db/schema";

export async function CompanyClientsSection({
  organizationId,
  companyId,
  canReadClients,
}: {
  organizationId: string;
  companyId: string;
  canReadClients: boolean;
}) {
  if (!canReadClients) {
    return null;
  }

  const linkedClients =
    await db
      .select({
        id:
          clients.id,

        firstName:
          clients.firstName,

        lastName:
          clients.lastName,

        middleName:
          clients.middleName,

        email:
          clients.email,

        phone:
          clients.phone,

        status:
          clients.status,

        isArchived:
          clients.isArchived,
      })
      .from(
        clientCompanies,
      )
      .innerJoin(
        clients,
        eq(
          clientCompanies.clientId,
          clients.id,
        ),
      )
      .where(
        and(
          eq(
            clientCompanies.organizationId,
            organizationId,
          ),

          eq(
            clientCompanies.companyId,
            companyId,
          ),

          eq(
            clients.organizationId,
            organizationId,
          ),

          isNull(
            clients.deletedAt,
          ),
        ),
      )
      .orderBy(
        asc(
          clients.lastName,
        ),
        asc(
          clients.firstName,
        ),
      );

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">
        Связанные клиенты
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Контактов:{" "}
        {
          linkedClients.length
        }
      </p>

      {linkedClients.length ===
      0 ? (
        <p className="mt-6 text-sm text-slate-400">
          С этой компанией пока
          нет связанных клиентов.
        </p>
      ) : (
        <div className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {linkedClients.map(
            (client) => {
              const fullName = [
                client.lastName,
                client.firstName,
                client.middleName,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  key={
                    client.id
                  }
                  className="flex flex-wrap items-center justify-between gap-4 p-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/crm/clients/${client.id}`}
                        className="font-medium transition hover:text-blue-600 hover:underline"
                      >
                        {fullName ||
                          "Без имени"}
                      </Link>

                      {client.isArchived && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          В архиве
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      {client.phone ||
                        client.email ||
                        "Контактные данные не указаны"}
                    </div>
                  </div>

                  <Link
                    href={`/crm/clients/${client.id}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium transition hover:bg-slate-50"
                  >
                    Открыть
                  </Link>
                </div>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}