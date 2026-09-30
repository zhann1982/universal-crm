$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$relativePath) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path)) {
        throw "File not found: $relativePath"
    }
    return ([System.IO.File]::ReadAllText($path)).Replace("`r`n", "`n")
}

function Write-Text([string]$relativePath, [string]$text) {
    $path = Join-Path $root $relativePath
    [System.IO.File]::WriteAllText($path, $text, $utf8)
}

function Patch-RolePermissions([string]$text, [string]$systemKey, [string[]]$permissionsToAdd) {
    $pattern = '(?s)(systemKey:\s*"' + [regex]::Escape($systemKey) + '".*?permissions:\s*\[)(.*?)(\]\s*,)'
    $match = [regex]::Match($text, $pattern)
    if (-not $match.Success) {
        throw "Role permission block not found for systemKey=$systemKey in src/db/seed.ts"
    }

    $body = $match.Groups[2].Value
    $missing = @()
    foreach ($permission in $permissionsToAdd) {
        if (-not $body.Contains('"' + $permission + '"')) {
            $missing += $permission
        }
    }

    if ($missing.Count -eq 0) {
        Write-Host "Already patched role: $systemKey"
        return $text
    }

    $lines = ($missing | ForEach-Object { '        "' + $_ + '",' }) -join "`n"

    if ($body -match '(?m)^\s*"pipelines\.read",') {
        $body = [regex]::Replace(
            $body,
            '(?m)^(\s*"pipelines\.read",)',
            $lines + "`n`n`$1",
            1
        )
    } else {
        $body = $body.TrimEnd() + "`n`n" + $lines + "`n      "
    }

    $replacement = $match.Groups[1].Value + $body + $match.Groups[3].Value
    $text = $text.Substring(0, $match.Index) + $replacement + $text.Substring($match.Index + $match.Length)
    Write-Host "Patched role permissions: $systemKey"
    return $text
}

# Required Stage 1 source files must already be present from the original archive.
$required = @(
    "src/db/activity-schema.ts",
    "src/modules/activity/entity-timeline.tsx",
    "src/app/crm/comments/actions.ts"
)
foreach ($relativePath in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath))) {
        throw "Missing Stage 1 file: $relativePath. Re-extract the original Comments + Activity Stage 1 archive first."
    }
}

# --------------------------------------------------
# Seed permission catalog
# --------------------------------------------------
$seedPath = "src/db/seed.ts"
$seed = Read-Text $seedPath

if (-not $seed.Contains('key: "comments.manage"')) {
    $catalog = @'
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
'@

    $pipelinePattern = '(?m)^\s*\{\s*\n\s*key:\s*"pipelines\.read",'
    $pipelineMatch = [regex]::Match($seed, $pipelinePattern)
    if (-not $pipelineMatch.Success) {
        throw "Could not find pipelines.read permission in src/db/seed.ts"
    }

    $seed = $seed.Insert($pipelineMatch.Index, $catalog + "`n")
    Write-Host "Patched permission catalog in src/db/seed.ts"
} else {
    Write-Host "Already patched permission catalog in src/db/seed.ts"
}

$seed = Patch-RolePermissions $seed "manager" @(
    "comments.read",
    "comments.create",
    "comments.update",
    "comments.archive",
    "activity.read"
)

$seed = Patch-RolePermissions $seed "viewer" @(
    "comments.read",
    "activity.read"
)

Write-Text $seedPath $seed

# --------------------------------------------------
# Task detail page: import + Timeline
# --------------------------------------------------
$taskPath = "src/app/crm/tasks/[id]/page.tsx"
$task = Read-Text $taskPath

if (-not $task.Contains('from "@/modules/activity/entity-timeline"')) {
    $task = 'import { EntityTimeline } from "@/modules/activity/entity-timeline";' + "`n" + $task
    Write-Host "Added EntityTimeline import to Task page"
} else {
    Write-Host "Already has EntityTimeline import"
}

if (-not $task.Contains('<EntityTimeline')) {
    $marker = @'
    </div>
  );
}

function ReminderDismissForm
'@

    if (-not $task.Contains($marker)) {
        throw "Task page insertion marker not found in src/app/crm/tasks/[id]/page.tsx"
    }

    $replacement = @'
      <EntityTimeline
        entityType="task"
        entityId={task.id}
        entityArchived={task.isArchived}
      />
    </div>
  );
}

function ReminderDismissForm
'@

    $task = $task.Replace($marker, $replacement)
    Write-Host "Added EntityTimeline to Task page"
} else {
    Write-Host "Already has EntityTimeline JSX"
}

Write-Text $taskPath $task

Write-Host ""
Write-Host "Repair completed successfully."
Write-Host "Now run:"
Write-Host "  npm run db:generate"
Write-Host "  npm run db:migrate"
Write-Host "  npm run db:seed"
Write-Host "  npx tsc --noEmit --incremental false"
Write-Host "  npm run lint"
Write-Host "  npm run build"
