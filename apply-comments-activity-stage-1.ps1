$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-NormalizedText([string]$relativePath) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path $path)) {
        throw "File not found: $relativePath"
    }

    $text = [System.IO.File]::ReadAllText($path)
    return $text.Replace("`r`n", "`n")
}

function Write-NormalizedText(
    [string]$relativePath,
    [string]$text
) {
    $path = Join-Path $root $relativePath
    [System.IO.File]::WriteAllText(
        $path,
        $text,
        $utf8
    )
}

function Replace-StageText(
    [string]$relativePath,
    [string]$oldText,
    [string]$newText,
    [string]$alreadyMarker
) {
    $text = Read-NormalizedText $relativePath

    if (
        $alreadyMarker -and
        $text.Contains($alreadyMarker)
    ) {
        Write-Host "Already patched: $relativePath"
        return
    }

    if (-not $text.Contains($oldText)) {
        throw "Patch marker not found in $relativePath"
    }

    $updated = $text.Replace(
        $oldText,
        $newText
    )

    Write-NormalizedText $relativePath $updated

    Write-Host "Patched: $relativePath"
}

# Stage 6 must already be installed.
if (-not (
    Test-Path (
        Join-Path $root "src/db/task-scheduling-schema.ts"
    )
)) {
    throw "Tasks Stage 6 is not installed: src/db/task-scheduling-schema.ts is missing."
}

# --------------------------------------------------
# Drizzle config
# --------------------------------------------------
$old = @'
    "./src/db/task-scheduling-schema.ts",
'@

$new = @'
    "./src/db/task-scheduling-schema.ts",
    "./src/db/activity-schema.ts",
'@

Replace-StageText "drizzle.config.ts" $old $new '"./src/db/activity-schema.ts"'

# --------------------------------------------------
# DB schema aggregation
# --------------------------------------------------
$old = @'
import * as taskSchedulingSchema from "./task-scheduling-schema";
'@

$new = @'
import * as taskSchedulingSchema from "./task-scheduling-schema";
import * as activitySchema from "./activity-schema";
'@

Replace-StageText "src/db/index.ts" $old $new 'import * as activitySchema from "./activity-schema";'

$text = Read-NormalizedText "src/db/index.ts"
if (-not $text.Contains("  ...activitySchema,")) {
    $old = @'
  ...taskSchedulingSchema,
'@

    $new = @'
  ...taskSchedulingSchema,
  ...activitySchema,
'@

    if (-not $text.Contains($old)) {
        throw "Schema spread marker not found in src/db/index.ts"
    }

    $text = $text.Replace(
        $old,
        $new
    )

    Write-NormalizedText "src/db/index.ts" $text

    Write-Host "Patched schema aggregation in src/db/index.ts"
}

# --------------------------------------------------
# PermissionKey
# --------------------------------------------------
$old = @'
  | "tasks.delete"
  | "pipelines.read"
'@

$new = @'
  | "tasks.delete"
  | "comments.read"
  | "comments.create"
  | "comments.update"
  | "comments.archive"
  | "comments.manage"
  | "activity.read"
  | "pipelines.read"
'@

Replace-StageText "src/lib/auth/permissions.ts" $old $new '| "comments.manage"'

# --------------------------------------------------
# Seed: permissions catalog
# --------------------------------------------------
$old = @'
  {
    key: "tasks.delete",
    name: "Удаление задач",
  },
  {
    key: "pipelines.read",
'@

$new = @'
  {
    key: "tasks.delete",
    name: "Удаление задач",
  },
  {
    key: "comments.read",
    name: "Просмотр комментариев",
  },
  {
    key: "comments.create",
    name: "Создание комментариев",
  },
  {
    key: "comments.update",
    name: "Изменение комментариев",
  },
  {
    key: "comments.archive",
    name: "Архивация комментариев",
  },
  {
    key: "comments.manage",
    name: "Управление чужими комментариями",
  },
  {
    key: "activity.read",
    name: "Просмотр истории CRM",
  },
  {
    key: "pipelines.read",
'@

Replace-StageText "src/db/seed.ts" $old $new 'key: "comments.manage"'

# Seed: Manager grants.
$text = Read-NormalizedText "src/db/seed.ts"
if (-not $text.Contains('        "comments.create",')) {
    $old = @'
        "tasks.read",
        "tasks.create",
        "tasks.update",
        "tasks.archive",

        "pipelines.read",
'@

    $new = @'
        "tasks.read",
        "tasks.create",
        "tasks.update",
        "tasks.archive",

        "comments.read",
        "comments.create",
        "comments.update",
        "comments.archive",
        "activity.read",

        "pipelines.read",
'@

    if (-not $text.Contains($old)) {
        throw "Manager permission marker not found in src/db/seed.ts"
    }

    $text = $text.Replace(
        $old,
        $new
    )

    Write-NormalizedText "src/db/seed.ts" $text

    Write-Host "Patched Manager permissions in src/db/seed.ts"
}

# Seed: Viewer grants.
$text = Read-NormalizedText "src/db/seed.ts"
$viewerMarker = @'
        "tasks.read",
        "pipelines.read",
'@

$viewerReplacement = @'
        "tasks.read",
        "comments.read",
        "activity.read",
        "pipelines.read",
'@

if ($text.Contains($viewerMarker)) {
    $text = $text.Replace(
        $viewerMarker,
        $viewerReplacement
    )

    Write-NormalizedText "src/db/seed.ts" $text

    Write-Host "Patched Viewer permissions in src/db/seed.ts"
}

# --------------------------------------------------
# Task detail: first reusable Activity Timeline
# --------------------------------------------------
$old = @'
import {
  taskIdSchema,
} from "@/lib/validation/task";
'@

$new = @'
import {
  taskIdSchema,
} from "@/lib/validation/task";
import {
  EntityTimeline,
} from "@/modules/activity/entity-timeline";
'@

Replace-StageText "src/app/crm/tasks/[id]/page.tsx" $old $new 'from "@/modules/activity/entity-timeline"'

$text = Read-NormalizedText "src/app/crm/tasks/[id]/page.tsx"

if (-not $text.Contains('<EntityTimeline')) {
    $old = @'
      </div>
    </div>
  );
}
'@

    $new = @'
      </div>

      <EntityTimeline
        entityType="task"
        entityId={task.id}
        entityArchived={
          task.isArchived
        }
      />
    </div>
  );
}
'@

    if (-not $text.Contains($old)) {
        throw "Task page end marker not found. The file may differ from the expected Stage 6 version."
    }

    $text = $text.Replace(
        $old,
        $new
    )

    Write-NormalizedText "src/app/crm/tasks/[id]/page.tsx" $text

    Write-Host "Added EntityTimeline to Task page"
}

Write-Host ""
Write-Host "Comments + Activity Stage 1 patch applied successfully."
Write-Host "Next commands:"
Write-Host "  npm run db:generate"
Write-Host "  npm run db:migrate"
Write-Host "  npm run db:seed"
Write-Host "  npx tsc --noEmit --incremental false"
Write-Host "  npm run lint"
Write-Host "  npm run build"
