import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionsPath = path.join(
  root,
  "src/app/crm/tasks/actions.ts",
);
const timelinePath = path.join(
  root,
  "src/modules/activity/entity-timeline.tsx",
);
const helperPath = path.join(
  root,
  "src/modules/activity/record-activity.ts",
);
const taskActivityPath = path.join(
  root,
  "src/modules/activity/task-activity.ts",
);

function fail(message) {
  throw new Error(message);
}

for (const required of [
  actionsPath,
  timelinePath,
  helperPath,
  taskActivityPath,
]) {
  if (!fs.existsSync(required)) {
    fail(`Required file not found: ${path.relative(root, required)}`);
  }
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

function writeNormalized(filePath, text) {
  fs.writeFileSync(
    filePath,
    text.endsWith("\n") ? text : `${text}\n`,
    "utf8",
  );
}

function sectionBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) {
    fail(`Start marker not found: ${start}`);
  }

  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0) {
    fail(`End marker not found after ${start}: ${end}`);
  }

  return {
    before: source.slice(0, startIndex),
    section: source.slice(startIndex, endIndex),
    after: source.slice(endIndex),
  };
}

function patchSection(source, start, end, transform) {
  const parts = sectionBetween(source, start, end);
  return parts.before + transform(parts.section) + parts.after;
}

function replaceRequired(source, oldText, newText, label) {
  if (source.includes(newText)) {
    return source;
  }

  if (!source.includes(oldText)) {
    fail(`Patch marker not found: ${label}`);
  }

  return source.replace(oldText, newText);
}

let actions = normalize(
  fs.readFileSync(actionsPath, "utf8"),
);

if (
  !actions.includes(
    '@/modules/activity/record-activity',
  )
) {
  const recurrenceImportEnd =
    '} from "@/modules/tasks/recurrence";';
  const index = actions.indexOf(
    recurrenceImportEnd,
  );

  if (index < 0) {
    fail("Task recurrence import marker not found.");
  }

  const lineEnd = actions.indexOf(
    "\n",
    index,
  );

  const activityImports = `
import {
  recordActivityEvents,
} from "@/modules/activity/record-activity";
import {
  buildBulkTaskEvent,
  buildTaskCreatedEvents,
  buildTaskLifecycleEvent,
  buildTaskUpdateEvents,
} from "@/modules/activity/task-activity";
`;

  actions =
    actions.slice(0, lineEnd + 1) +
    activityImports +
    actions.slice(lineEnd + 1);

  console.log("Added Task activity imports.");
} else {
  console.log("Task activity imports already present.");
}

actions = patchSection(
  actions,
  "export async function createTask(",
  "export async function updateTask(",
  (section) => {
    if (
      section.includes(
        "buildTaskCreatedEvents({",
      )
    ) {
      console.log("createTask already records activity.");
      return section;
    }

    const marker = `        recurrenceSequence: 1,
      });`;

    const replacement = `${marker}

    await recordActivityEvents({
      organizationId:
        organization.id,
      entityType: "task",
      entityId:
        createdTask.id,
      actorMemberId:
        member.id,
      events:
        buildTaskCreatedEvents({
          status: data.status,
          priority:
            data.priority,
          reminderAt:
            data.reminderAt,
          recurrenceFrequency:
            data.recurrenceFrequency,
        }),
    });`;

    console.log("Patched createTask activity.");
    return replaceRequired(
      section,
      marker,
      replacement,
      "createTask schedule insert",
    );
  },
);

actions = patchSection(
  actions,
  "export async function updateTask(",
  "export async function completeTask(",
  (section) => {
    let next = section;

    if (!next.includes("title: tasks.title,")) {
      const oldSelect = `        dealId:
          tasks.dealId,
        status:
          tasks.status,
        dueAt:`;

      const newSelect = `        dealId:
          tasks.dealId,
        title: tasks.title,
        description:
          tasks.description,
        status:
          tasks.status,
        priority:
          tasks.priority,
        dueAt:`;

      next = replaceRequired(
        next,
        oldSelect,
        newSelect,
        "updateTask existing task fields",
      );
      console.log("Expanded updateTask previous state.");
    }

    if (
      !next.includes(
        "events: buildTaskUpdateEvents({",
      )
    ) {
      const marker = `    if (
      existingTask.status !==
        "completed" &&
      data.status ===
        "completed"
    ) {`;

      const activityBlock = `    await recordActivityEvents({
      organizationId:
        organization.id,
      entityType: "task",
      entityId:
        existingTask.id,
      actorMemberId:
        member.id,
      events: buildTaskUpdateEvents({
        previous: {
          title:
            existingTask.title,
          description:
            existingTask.description,
          status:
            existingTask.status,
          priority:
            existingTask.priority,
          ownerMemberId:
            existingTask.ownerMemberId,
          dueAt:
            existingTask.dueAt,
          clientId:
            existingTask.clientId,
          companyId:
            existingTask.companyId,
          dealId:
            existingTask.dealId,
        },
        next: {
          title: data.title,
          description:
            data.description,
          status: data.status,
          priority:
            data.priority,
          ownerMemberId:
            data.ownerMemberId,
          dueAt: data.dueAt,
          clientId:
            data.clientId,
          companyId:
            data.companyId,
          dealId: data.dealId,
        },
        previousSchedule:
          existingSchedule
            ? {
                reminderAt:
                  existingSchedule.reminderAt,
                recurrenceFrequency:
                  existingSchedule.recurrenceFrequency,
                recurrenceInterval:
                  existingSchedule.recurrenceInterval,
                recurrenceEndAt:
                  existingSchedule.recurrenceEndAt,
              }
            : null,
        nextSchedule: {
          reminderAt:
            data.reminderAt,
          recurrenceFrequency:
            data.recurrenceFrequency,
          recurrenceInterval:
            data.recurrenceFrequency ===
            "none"
              ? 1
              : data.recurrenceInterval,
          recurrenceEndAt:
            data.recurrenceFrequency ===
            "none"
              ? null
              : data.recurrenceEndAt,
        },
      }),
    });

${marker}`;

      next = replaceRequired(
        next,
        marker,
        activityBlock,
        "updateTask completion marker",
      );
      console.log("Patched updateTask activity diff.");
    }

    if (
      !next.includes(
        "taskId:\n          existingTask.id,\n        actorMemberId:",
      )
    ) {
      const oldCall = `      await createNextRecurringOccurrence({
        organizationId:
          organization.id,
        taskId:
          existingTask.id,
      });`;

      const newCall = `      await createNextRecurringOccurrence({
        organizationId:
          organization.id,
        taskId:
          existingTask.id,
        actorMemberId:
          member.id,
      });`;

      next = replaceRequired(
        next,
        oldCall,
        newCall,
        "updateTask recurring call",
      );
      console.log("Passed actor to updateTask recurrence.");
    }

    return next;
  },
);

function patchSimpleLifecycleFunction({
  source,
  functionName,
  nextFunctionName,
  eventAction,
  resultVariable,
}) {
  return patchSection(
    source,
    `export async function ${functionName}(`,
    `export async function ${nextFunctionName}(`,
    (section) => {
      let next = section;

      next = next.replace(
        "const { organization } =\n    await requirePermission(",
        "const { organization, member } =\n    await requirePermission(",
      );

      if (
        !next.includes(
          `buildTaskLifecycleEvent(\n        "${eventAction}"`,
        )
      ) {
        const marker = `  revalidateTaskPaths(\n    ${resultVariable}.id,\n  );`;
        const block = `  await recordActivityEvents({
    organizationId:
      organization.id,
    entityType: "task",
    entityId:
      ${resultVariable}.id,
    actorMemberId:
      member.id,
    events: [
      buildTaskLifecycleEvent(
        "${eventAction}",
      ),
    ],
  });

${marker}`;

        next = replaceRequired(
          next,
          marker,
          block,
          `${functionName} activity marker`,
        );
        console.log(`Patched ${functionName} activity.`);
      }

      return next;
    },
  );
}

// completeTask needs activity before recurrence and passes the actor to recurrence.
actions = patchSection(
  actions,
  "export async function completeTask(",
  "export async function reopenTask(",
  (section) => {
    let next = section.replace(
      "const { organization } =\n    await requirePermission(",
      "const { organization, member } =\n    await requirePermission(",
    );

    if (
      !next.includes(
        'buildTaskLifecycleEvent(\n        "complete"',
      )
    ) {
      const marker = `  await createNextRecurringOccurrence({`;
      const block = `  await recordActivityEvents({
    organizationId:
      organization.id,
    entityType: "task",
    entityId: updated.id,
    actorMemberId:
      member.id,
    events: [
      buildTaskLifecycleEvent(
        "complete",
      ),
    ],
  });

${marker}`;
      next = replaceRequired(
        next,
        marker,
        block,
        "completeTask recurring marker",
      );
      console.log("Patched completeTask activity.");
    }

    if (
      !next.includes(
        "taskId:\n      updated.id,\n    actorMemberId:",
      )
    ) {
      const oldCall = `  await createNextRecurringOccurrence({
    organizationId:
      organization.id,
    taskId:
      updated.id,
  });`;
      const newCall = `  await createNextRecurringOccurrence({
    organizationId:
      organization.id,
    taskId:
      updated.id,
    actorMemberId:
      member.id,
  });`;
      next = replaceRequired(
        next,
        oldCall,
        newCall,
        "completeTask recurring call",
      );
      console.log("Passed actor to completeTask recurrence.");
    }

    return next;
  },
);

actions = patchSimpleLifecycleFunction({
  source: actions,
  functionName: "reopenTask",
  nextFunctionName: "archiveTask",
  eventAction: "reopen",
  resultVariable: "updated",
});

actions = patchSimpleLifecycleFunction({
  source: actions,
  functionName: "archiveTask",
  nextFunctionName: "restoreTask",
  eventAction: "archive",
  resultVariable: "archived",
});

actions = patchSimpleLifecycleFunction({
  source: actions,
  functionName: "restoreTask",
  nextFunctionName: "bulkTaskAction",
  eventAction: "restore",
  resultVariable: "restored",
});

actions = patchSection(
  actions,
  "export async function bulkTaskAction(",
  "export async function dismissTaskReminder(",
  (section) => {
    let next = section;

    next = next.replace(
      `  const {
    organization,
  } = await requirePermission(`,
      `  const {
    organization,
    member,
  } = await requirePermission(`,
    );

    if (
      !next.includes(
        "const activityEvent =\n      buildBulkTaskEvent(action);",
      )
    ) {
      const marker = `    if (action === "complete") {`;
      const block = `    const activityEvent =
      buildBulkTaskEvent(action);

    if (activityEvent) {
      await recordActivityEvents({
        organizationId:
          organization.id,
        entityType: "task",
        entityId: updatedId,
        actorMemberId:
          member.id,
        events: [
          activityEvent,
        ],
      });
    }

${marker}`;
      next = replaceRequired(
        next,
        marker,
        block,
        "bulkTaskAction activity marker",
      );
      console.log("Patched bulk task activity.");
    }

    if (
      !next.includes(
        "taskId:\n          updatedId,\n        actorMemberId:",
      )
    ) {
      const oldCall = `      await createNextRecurringOccurrence({
        organizationId:
          organization.id,
        taskId:
          updatedId,
      });`;
      const newCall = `      await createNextRecurringOccurrence({
        organizationId:
          organization.id,
        taskId:
          updatedId,
        actorMemberId:
          member.id,
      });`;
      next = replaceRequired(
        next,
        oldCall,
        newCall,
        "bulkTaskAction recurring call",
      );
      console.log("Passed actor to bulk recurrence.");
    }

    return next;
  },
);

actions = patchSection(
  actions,
  "export async function dismissTaskReminder(",
  "async function createNextRecurringOccurrence(",
  (section) => {
    let next = section.replace(
      "const { organization } =\n    await requirePermission(",
      "const { organization, member } =\n    await requirePermission(",
    );

    if (
      !next.includes(
        'buildTaskLifecycleEvent(\n        "reminder_dismissed"',
      )
    ) {
      const marker = `  revalidateTaskPaths(\n    updated.taskId,\n  );`;
      const block = `  await recordActivityEvents({
    organizationId:
      organization.id,
    entityType: "task",
    entityId:
      updated.taskId,
    actorMemberId:
      member.id,
    events: [
      buildTaskLifecycleEvent(
        "reminder_dismissed",
      ),
    ],
  });

${marker}`;
      next = replaceRequired(
        next,
        marker,
        block,
        "dismissTaskReminder activity marker",
      );
      console.log("Patched reminder dismissal activity.");
    }

    return next;
  },
);

actions = patchSection(
  actions,
  "async function createNextRecurringOccurrence(",
  "function getTaskReturnTo(",
  (section) => {
    let next = section;

    if (
      !next.includes(
        "actorMemberId,\n}: {",
      )
    ) {
      const oldSignature = `async function createNextRecurringOccurrence({
  organizationId,
  taskId,
}: {
  organizationId: string;
  taskId: string;
}) {`;
      const newSignature = `async function createNextRecurringOccurrence({
  organizationId,
  taskId,
  actorMemberId,
}: {
  organizationId: string;
  taskId: string;
  actorMemberId: string | null;
}) {`;
      next = replaceRequired(
        next,
        oldSignature,
        newSignature,
        "createNextRecurringOccurrence signature",
      );
      console.log("Expanded recurring task activity context.");
    }

    if (
      !next.includes(
        'summary: "Создана повторяющаяся задача"',
      )
    ) {
      const marker = `        recurrenceSequence:
          source.recurrenceSequence +
          1,
      });`;
      const block = `${marker}

    await recordActivityEvents({
      organizationId,
      entityType: "task",
      entityId: nextTask.id,
      actorMemberId,
      events: [
        {
          eventType: "task.created",
          summary: "Создана повторяющаяся задача",
          details:
            \`Элемент серии №\${source.recurrenceSequence + 1}\`,
        },
      ],
    });

    await recordActivityEvents({
      organizationId,
      entityType: "task",
      entityId: source.taskId,
      actorMemberId,
      events: [
        {
          eventType:
            "task.recurrence_next_created",
          summary:
            "Создана следующая задача серии",
        },
      ],
    });`;
      next = replaceRequired(
        next,
        marker,
        block,
        "recurring task schedule insert",
      );
      console.log("Patched recurring task creation activity.");
    }

    return next;
  },
);

writeNormalized(
  actionsPath,
  actions,
);

let timeline = normalize(
  fs.readFileSync(
    timelinePath,
    "utf8",
  ),
);

const oldEmpty =
  "История пока пуста. Первое событие появится после добавления комментария.";
const newEmpty =
  "История пока пуста. События появятся после изменений записи или добавления комментария.";

if (timeline.includes(oldEmpty)) {
  timeline = timeline.replace(
    oldEmpty,
    newEmpty,
  );
  console.log("Updated Timeline empty-state text.");
} else {
  console.log("Timeline empty-state text already updated or customized.");
}

if (
  !timeline.includes(
    'event.eventType !==\n                      "comment.created"',
  )
) {
  const updatedCommentBlock = `                    {event.eventType ===
                      "comment.updated" &&
                      event.details && (
                        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          <span className="font-medium">
                            Новый текст: {" "}
                          </span>
                          <span className="whitespace-pre-wrap">
                            {event.details}
                          </span>
                        </div>
                      )}`;

  const genericDetailsBlock = `${updatedCommentBlock}

                    {event.eventType !==
                      "comment.created" &&
                      event.eventType !==
                        "comment.updated" &&
                      event.details && (
                        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          <span className="whitespace-pre-wrap">
                            {event.details}
                          </span>
                        </div>
                      )}`;

  if (timeline.includes(updatedCommentBlock)) {
    timeline = timeline.replace(
      updatedCommentBlock,
      genericDetailsBlock,
    );
    console.log(
      "Enabled details for non-comment activity events.",
    );
  } else {
    fail(
      "Timeline comment.updated marker not found. Stage 1 Timeline differs from expected version.",
    );
  }
}

writeNormalized(
  timelinePath,
  timeline,
);


const packagePath = path.join(
  root,
  "package.json",
);

if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(
    fs.readFileSync(
      packagePath,
      "utf8",
    ),
  );

  const testPath =
    "src/modules/activity/task-activity.test.ts";
  const currentTest =
    packageJson.scripts?.test;

  if (
    typeof currentTest === "string" &&
    !currentTest.includes(testPath)
  ) {
    packageJson.scripts.test =
      `${currentTest} ${testPath}`;

    fs.writeFileSync(
      packagePath,
      `${JSON.stringify(
        packageJson,
        null,
        2,
      )}\n`,
      "utf8",
    );

    console.log(
      "Added Stage 2 activity tests to npm test.",
    );
  } else {
    console.log(
      "Stage 2 activity test command already present or package test script is unavailable.",
    );
  }
}

console.log("");
console.log("Comments + Activity Stage 2 patch applied successfully.");
console.log("No database migration is required for Stage 2.");
