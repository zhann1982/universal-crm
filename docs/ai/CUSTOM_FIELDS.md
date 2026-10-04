# Custom fields (D062)

Open **Пользовательские поля** in the CRM sidebar (`/crm/settings/custom-fields`).
The link and configuration actions require `settings.manage`. Choose Clients, Companies or
Deals, add a field, specify required/position and (for a select) one unique option per line.
At most 30 options, 50 active fields and 150 definitions including archives per entity.

Types: text (2000 characters), decimal number (12 integer / 6 fractional digits, dot separator),
calendar date, yes/no and fixed-option select. Type/options are immutable after creation.
Rename/order/required can change with an expected definition version. Archive frees an active
slot and preserves values; restore must respect name uniqueness and the active limit.

Creation forms contain the active fields. On an existing detail card, **Дополнительные сведения**
shows values and **Изменить поля** opens the separate custom-value form. It requires parent
read + update permissions and an active, non-deleted record. Core edit forms keep their existing
semantics and do not overwrite custom values. No field-specific visibility policy is introduced.

Required applies to creation and custom-value saves. Adding a required field does not backfill
existing records or block unrelated edits. A false boolean is a valid supplied value. Clearing
an optional value removes its active key; archived keys cannot be changed or removed. A changed
configuration or custom version rejects an old form, preserving controlled draft inputs.

Values reside in parent JSONB with definition UUID keys, keeping creation atomic. Application
validation and migration 0019 PostgreSQL triggers enforce types/scope/limits/lifecycle/revision.
Focused saves lock Organization before parent; Deal writes advance its main optimistic version.
Activity contains only “Пользовательские поля: изменение”, without custom names or old/new values.
History insertion failure rolls back values and versions. Existing history migration is unchanged.

Filtering/saved views by custom values, importing values and editing select options are future
extensions. Migration 0019 is generated and tested, not applied to the connected database.
