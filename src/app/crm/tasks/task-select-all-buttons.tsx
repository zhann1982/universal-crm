"use client";

function setVisibleTaskSelection(
  checked: boolean,
) {
  const checkboxes =
    document.querySelectorAll<HTMLInputElement>(
      'input[data-task-select="true"]',
    );

  for (const checkbox of checkboxes) {
    checkbox.checked = checked;
  }
}

export function TaskSelectAllButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() =>
          setVisibleTaskSelection(true)
        }
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
      >
        Выбрать все на странице
      </button>

      <button
        type="button"
        onClick={() =>
          setVisibleTaskSelection(false)
        }
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
      >
        Снять выбор
      </button>
    </div>
  );
}
