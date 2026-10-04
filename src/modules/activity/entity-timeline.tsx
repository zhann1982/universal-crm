import Link from "@/components/app-link";
import { CommentLifecycleForm } from "@/app/crm/comments/comment-lifecycle-form";
import { getCurrentAccessContext } from "@/lib/auth/permissions";
import { archiveComment, restoreComment } from "@/app/crm/comments/actions";
import { CommentComposer } from "@/app/crm/comments/comment-composer";
import { CommentEditor } from "@/app/crm/comments/comment-editor";

import { ActivityTime } from "./activity-time";
import { getEntityTarget } from "./entity-target";
import {
  getEntityReadPermission,
  type ActivityEntityType,
} from "./entity-types";

import { readTimelineRows } from "./read-timeline";

export async function EntityTimeline({
  entityType,
  entityId,
  entityArchived,
  cursor,
}: {
  entityType: ActivityEntityType;
  entityId: string;
  entityArchived?: boolean;
  cursor?: string;
}) {
  const { organization, member, permissions } = await getCurrentAccessContext();

  if (!permissions.has(getEntityReadPermission(entityType))) {
    return null;
  }

  const target = await getEntityTarget({
    organizationId: organization.id,
    entityType,
    entityId,
  });

  if (!target) {
    return null;
  }

  const canReadComments = permissions.has("comments.read");
  const canReadActivity = permissions.has("activity.read");
  const canCreateComment =
    permissions.has("comments.create") &&
    !(entityArchived || target.isArchived);

  if (!canReadComments && !canReadActivity && !canCreateComment) {
    return null;
  }

  const { eventRows, commentRows, nextCursor } = await readTimelineRows({
    organizationId: organization.id,
    entityType,
    entityId,
    permissions,
    cursor,
  });

  const commentsById = new Map(
    commentRows.map((comment) => [comment.id, comment]),
  );

  const canManageComments = permissions.has("comments.manage");
  const canReadMembers = permissions.has("members.read");

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">История и комментарии</h2>

          <p className="mt-1 text-sm text-slate-500">
            Последние события записи и рабочие комментарии команды.
          </p>
        </div>

        {eventRows.length > 0 && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Последние {eventRows.length}
          </span>
        )}
      </div>

      {canCreateComment && (
        <CommentComposer entityType={entityType} entityId={entityId} />
      )}

      {canReadActivity ? (
        eventRows.length > 0 ? (
          <div className="mt-6 space-y-4">
            {eventRows.map((event) => {
              const currentComment = event.commentId
                ? commentsById.get(event.commentId)
                : undefined;

              const actorLabel =
                event.actorMemberId === member.id
                  ? member.displayName || "Я"
                  : canReadMembers
                    ? event.actorDisplayName || "Сотрудник"
                    : "Сотрудник";

              const ownsComment = currentComment?.authorMemberId === member.id;

              const canEdit = Boolean(
                currentComment &&
                !currentComment.isArchived &&
                !(entityArchived || target.isArchived) &&
                permissions.has("comments.update") &&
                (ownsComment || canManageComments),
              );

              const canArchive = Boolean(
                currentComment &&
                !(entityArchived || target.isArchived) &&
                permissions.has("comments.archive") &&
                (ownsComment || canManageComments),
              );

              const isCommentCreated = event.eventType === "comment.created";

              return (
                <article
                  key={event.id}
                  className="relative rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {event.summary}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {actorLabel}
                        {" · "}
                        <ActivityTime value={event.createdAt.toISOString()} />
                      </div>
                    </div>

                    {currentComment?.isArchived && isCommentCreated && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        Комментарий в архиве
                      </span>
                    )}
                  </div>

                  {isCommentCreated && (
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {currentComment?.body ||
                        event.details ||
                        "Комментарий недоступен."}
                    </div>
                  )}

                  {event.eventType === "comment.updated" && event.details && (
                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <span className="font-medium">Новый текст: </span>
                      <span className="whitespace-pre-wrap">
                        {event.details}
                      </span>
                    </div>
                  )}

                  {event.eventType !== "comment.created" &&
                    event.eventType !== "comment.updated" &&
                    event.details && (
                      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <span className="whitespace-pre-wrap">
                          {event.details}
                        </span>
                      </div>
                    )}

                  {isCommentCreated && currentComment && (
                    <div className="mt-3 flex flex-wrap items-start gap-3 border-t border-slate-100 pt-3">
                      {canEdit && (
                        <div className="min-w-64 flex-1">
                          <CommentEditor
                            key={`${currentComment.id}:${currentComment.version}`}
                            commentId={currentComment.id}
                            version={currentComment.version}
                            body={currentComment.body}
                          />
                        </div>
                      )}

                      {canArchive && !currentComment.isArchived && (
                        <CommentLifecycleForm
                          action={archiveComment}
                          commentId={currentComment.id}
                          version={currentComment.version}
                          label="В архив"
                        />
                      )}

                      {canArchive && currentComment.isArchived && (
                        <CommentLifecycleForm
                          action={restoreComment}
                          commentId={currentComment.id}
                          version={currentComment.version}
                          label="Восстановить"
                        />
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-400">
            История пока пуста. События появятся после изменений записи или
            добавления комментария.
          </p>
        )
      ) : canReadComments ? (
        <div className="mt-6 space-y-3">
          {commentRows.length > 0 ? (
            commentRows.map((comment) => (
              <div
                key={comment.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="whitespace-pre-wrap text-sm text-slate-700">
                  {comment.body}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Комментариев пока нет.</p>
          )}
        </div>
      ) : null}
      <nav aria-label="Страницы истории" className="mt-5 flex gap-4 text-sm">
        {cursor && (
          <Link href={`/crm/history?type=${entityType}&id=${entityId}`}>
            Последние события
          </Link>
        )}
        {nextCursor && (
          <Link
            href={`/crm/history?type=${entityType}&id=${entityId}&cursor=${encodeURIComponent(nextCursor)}`}
          >
            Более ранние записи →
          </Link>
        )}
      </nav>
    </section>
  );
}
