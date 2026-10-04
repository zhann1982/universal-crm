import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { canEditValues, fieldPermissions } from "./policy";
import { CustomFieldInputs } from "./inputs";
test("custom values inherit each parent permission; settings and other modules confer no access", () => {
  for (const entity of ["client", "company", "deal"] as const) {
    const p = fieldPermissions[entity];
    assert.equal(canEditValues(entity, new Set(["settings.manage"])), false);
    assert.equal(canEditValues(entity, new Set([p.read])), false);
    assert.equal(canEditValues(entity, new Set([p.update])), false);
    assert.equal(canEditValues(entity, new Set([p.read, p.update])), true);
    for (const other of ["client", "company", "deal"] as const)
      if (other !== entity)
        assert.equal(
          canEditValues(
            entity,
            new Set(Object.values(fieldPermissions[other])),
          ),
          false,
        );
  }
});
test("field form includes rendered configuration, required controls, literal escaped labels and no archived input", () => {
  const field = {
    id: "f",
    entity: "client" as const,
    name: "<script>Label</script>",
    type: "boolean" as const,
    required: true,
    position: 0,
    options: [],
    version: 1,
    archived: false,
  };
  const html = renderToStaticMarkup(
    createElement(CustomFieldInputs, {
      fields: [field, { ...field, id: "archived", archived: true }],
      revision: 7,
      values: { f: "false" },
    }),
  );
  assert.match(html, /name="customFieldSchema" value="7"/);
  assert.match(html, /required=""/);
  assert.match(html, /value="false" selected=""/);
  assert.match(html, /&lt;script&gt;Label&lt;\/script&gt;/);
  assert.doesNotMatch(html, /name="custom:archived"/);
});
