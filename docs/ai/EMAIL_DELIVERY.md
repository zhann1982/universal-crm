# Email delivery

Invitation creation works without a mail provider. The authorized administrator receives a one-time
manual link immediately after creation/reissue. No raw token is stored, so a lost link must be
reissued; this invalidates the previous link. Pending and expired invitations can be revoked or
reissued from Team. Accepted/revoked invitations cannot be revived.

Optional transport is prepared for Resend using its official HTTP API, without an SDK dependency
or provisioned service account. Provider documentation: https://resend.com/docs/api-reference/emails/send-email

Set these values privately in the deployment environment (never commit real values):

- RESEND_API_KEY: sending API key from the chosen Resend account.
- EMAIL_FROM: verified sender address, optionally `Universal CRM <crm@your-domain>`.
- BETTER_AUTH_URL: canonical HTTPS application origin for production, e.g. `https://crm.your-domain`.

Restart the application after configuring. Send a controlled invitation to an address you own,
verify the link origin, email verification and exact invited identity, then acceptance, revoke and
reissue. Also verify bounce/spam behavior through the provider dashboard. The UI reports provider
acceptance, missing configuration or unconfirmed sending; acceptance is not proof of inbox delivery.
Better Auth verification uses the same configured transport. Local verification fallback remains
development-only; production does not claim successful sending without configuration.

The database commits the invitation before external sending. Sending failures preserve a valid
manual link; reissue creates a fresh link and a new idempotency key. There is no background retry
queue. Requests time out after 10 seconds; retries to the provider use a stable hashed key for the
same invitation token. Raw tokens/API credentials/provider error responses never enter toast text.

Tests use mocked fetch and isolated PostgreSQL. No actual mail account has been connected or
message delivered in this stabilization cycle.
