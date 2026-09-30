import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { OrganizationForm, OrganizationProvider } from "./organization-context";

test("server action forms carry their rendered organization, independently of other tabs", () => {
  for (const id of ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"]) {
    const html = renderToStaticMarkup(<OrganizationProvider organizationId={id}>
      <OrganizationForm action={async () => {}}><button>Save</button></OrganizationForm>
    </OrganizationProvider>);
    assert.ok(html.includes(`name="_organizationId" value="${id}"`));
  }
});

test("search forms do not add a tenant query parameter", () => {
  const html = renderToStaticMarkup(<OrganizationProvider organizationId="organization">
    <OrganizationForm method="get"><input name="q" /></OrganizationForm>
  </OrganizationProvider>);
  assert.ok(!html.includes("_organizationId"));
});

test("mutation forms outside a CRM organization fail closed", () => {
  assert.throws(() => renderToStaticMarkup(<OrganizationForm action={async () => {}} />), /OrganizationProvider/);
});
