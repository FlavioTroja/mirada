# Authentication

Two ways in, and one rule that keeps them apart.

## The boundary

> **Authentik says WHO you are. Mirada decides WHAT you can do.**

Roles come from `RoleToUser`, tenancy scope from `OrganizationMember`, permissions
from `PermissionConfig`. **No claim in an OIDC token ever grants anything.** Do not
add role or organization mapping from token claims: every finder in the codebase
depends on those three tables, and a second source of truth would silently
disagree with them.

## The two routes in

| route | what it is | lives in |
|---|---|---|
| `POST /auth/login` | username + password, bcrypt | `AuthService.login` |
| `POST /auth/sso` + `POST /auth/sso/signup` | OpenID Connect against Authentik | `SsoService`, `@utils/adapters/oidc` |

**Both end at the same place**: `AuthService.toTokenPayload` → the very same signed
JWT. From that point the two are indistinguishable — same `wsCode`, same roles,
same `Authenticate()`. When adding a third way in, end it there too: anything else
means a session the rest of the application does not understand.

`AuthService.assertAccountCanLogin` is **public** for this reason. Every entry
route must call it: authenticating elsewhere proves who you are, not that this
account is still allowed in. Suspension, expiry and deletion are decisions of this
application.

## `PASSWORD_LOGIN`

`on` (default) · `god-only` (break-glass) · `off`.

⚠️ **An unrecognised value means `on`, not `off`.** Deliberate: the switch exists
to guarantee a way back in, and a typo must not lock the staff out. The mistake is
shouted in the log instead.

`off` is refused **before** touching the database — nothing to verify, and no
response-time signal about whether a username exists. `god-only` is checked
**after** the password comparison: to know whether this person is `GOD` you must
first know it is this person.

## OIDC specifics

- **The backend exchanges the code**, not the browser. No provider token ever
  enters the page, and we do not depend on Authentik's CORS headers. PKCE keeps
  its purpose: the verifier is born in the browser and travels with the code.
- **`User.authentikSub` is the `sub`, never the email.** Emails change and get
  reassigned; binding identity to one means whoever inherits an address inherits
  the account. The email match happens **once**, at first sign-in, then the `sub`
  rules.
- **`email_verified` guards LINKING, not signing up.** The check runs *after* the
  user lookup: claiming the address of an existing account is account takeover;
  having no match at all is just registering. Ordering it the other way refused
  everyone — see `deploy/production/authentik/README.md` on Authentik's mapping.
- **`OIDC_ISSUER` must end with a slash** and is the *application's* issuer, not
  the domain root. `jose` compares the exact string.
- Missing `OIDC_ISSUER`/`OIDC_CLIENT_ID` means SSO is **off, not broken**:
  `GET /auth/sso/config` answers `enabled: false` and the sign-in page falls back.
  An unreachable identity provider must never make the back-office unreachable.

## The signup ticket

`@utils/helpers/ssoTicket` — proof of identity that survives the already-spent
authorization code, valid 15 minutes.

⚠️ **It is deliberately NOT a JWT.** Signing it with `reply.jwtSign` would produce
a token that `Authenticate()` — which only calls `jwtVerify` — accepts as a
**valid session**. The defence is the *shape*, not a check someone must remember:
`body.signature` is not a JWT, and `jwtVerify` rejects it without anyone having
thought about it. Same reasoning as `@utils/helpers/emailToken`.

## Self-signup and invitations

**The invitation token decides whether a tenant is born.** No invitation → a new
`Organization` (`PENDING`, so it cannot sell until approved). A valid invitation →
membership in the named organization and **no** organization created. The two are
mutually exclusive **in the Zod schema**, not in an `if`: a rule like that must not
be left to code someone will rewrite.

`OrganizationInvitation` is a **row**, not a signed token: an invitation must be
revocable and single-use, and a signature can do neither. The database stores the
**fingerprint**; the token itself exists only inside the emailed link. It is bound
to the email — without that, a forwarded link hands a stranger ownership of someone
else's organization.

`SsoService` **never creates an organization on its own initiative** and never
invents roles. When dancers arrive from the mobile app, `linkByEmail` is the place
to add `DANCER` — nowhere else.
