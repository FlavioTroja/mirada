# CLAUDE.md

mirada-app — the back-office (Angular 20 + `@keijo/ui`), served at `app.mirada.dance`.

UI conventions come from `@keijo/ui` and the keijo skills. This file records only
what is **specific to this application** and would otherwise be rediscovered the
expensive way.

## Where a session comes from

**Authentik is the only way in.** `PASSWORD_LOGIN=off` on the backend, so
`POST /auth/login` refuses everyone; the form still exists in this app and must
keep working, because re-enabling it is the documented way back in when Authentik
is unreachable. Do not delete it.

Four routes live **outside the shell** (`chromeless` in `app.ts`):

| route | what it does |
|---|---|
| `/` | presents the product; sends an authenticated visitor to `landingFor(can)` |
| `/login` | with `passwordLogin: 'off'` it does not render — it starts OIDC |
| `/auth/callback` | the return from Authentik; posts the code to the backend |
| `/registrazione` | opens an organization, or accepts an invitation |

⚠️ **The root is matched with `===`, not `startsWith`.** `'/'.startsWith('/')` is
true for *every* route: get it wrong and the sidebar never appears again.

⚠️ **The sign-in button starts the OIDC authorization, it does not link to
`https://auth.mirada.dance/`.** The provider's root shows the same screen but never
comes back — the visitor ends up authenticated *on Authentik*, outside Mirada,
convinced the sign-in failed.

⚠️ **`?manuale=1` is the escape from the loop.** `/login` bounces to the provider
on its own; without the parameter, anyone returning after a refused sign-in would
bounce forever and never read why. Every "back to sign-in" link carries it.

⚠️ **`OidcService.start()` clears the existing session before leaving.** A stale
token in `localStorage` makes the app boot, call `GET /auth/profile`, take a `401`,
and navigate to `/login` — **cancelling the in-flight request** of the callback
page. The backend answers into the void and the screen reads «Server non
raggiungibile», which has nothing to do with the network. For the same reason the
interceptor no longer redirects away from `/auth/callback` and `/registrazione`.

Provider settings are **not compiled into the bundle**: they come from
`GET /api/auth/sso/config`. Changing provider must not require rebuilding the SPA.

## Signing out is two sessions, not one

⚠️ **`AuthService.logout()` is local only.** It drops the JWT; the Authentik
session stays open, so «Accedi» right after asks nothing and lets the same person
straight back in. The symptom people report is «I can't log out», and it looks
like a bug in this app. The full exit is **`OidcService.esci()`**, which also
sends the browser to the provider's `end_session_endpoint`.

That split is deliberate: the `401` interceptor and `OidcService.start()` both
call `logout()`, and handing the browser to the provider there would mean, in
order, a redirect loop and a half-cancelled sign-in.

⚠️ **`esci()` returns `true` when the browser is leaving.** Navigating after that
cancels the sign-out. Every caller is `if (await this.oidc.esci()) return;`.

⚠️ **The post-logout URI is the root, not `/login`.** With `passwordLogin: 'off'`
the sign-in page starts OIDC on its own: landing there after signing out walks
straight back in.

⚠️ **Password sessions never go to the provider.** They have no session to close,
and `end-session/` answers an anonymous visitor with the *authentication* flow —
"log out" would land on a login screen. `localStorage['sso-sessione']`, written
beside the token and cleared with it, is what tells the two apart.

⚠️ **A missing `sso-sessione` does not mean "password".** Sessions opened before
that key existed do not carry it, and reading it literally hands every user who
was signed in on deploy day the exact bug this is meant to fix. With
`passwordLogin: 'off'` the inference is certain — `POST /auth/login` refuses
everyone, so the session can only have come from the provider — and `esci()`
falls back to it. It heals itself: the next sign-in writes the key.

Authentik must be configured for this to complete: the post-logout URI among the
provider's `redirect_uris`, and an invalidation flow that really contains the
logout stage. Both in `deploy/production/authentik/README.md`.

## Two traps that cost real time

⚠️ **Backticks inside a `styles` comment break the build.** `npm run check:templates`
covers component *templates* only. In `styles: [...]` a backtick closes the template
literal, and the compiler reports `Failed to resolve styles at position 1 to a
string` — a message about types, for what is a quoting mistake. Never write
backticks in CSS comments.

⚠️ **`100vw` includes the vertical scrollbar.** On any page tall enough to scroll,
a `100vw` container is wider than the space available and produces a *horizontal*
scrollbar. Use `100%`. An `overflow-x: hidden` on that element does not help: the
overflow is on the document.

## Cross-app rules

- The theme lives in `../shared/mirada-theme.scss`, shared with `www/`: the palette
  exists in **one** place, and both frontends are rebuilt when it changes.
- Anything published to `mirada.dance/images/branding/` (Authentik's logo, fonts,
  background) is served by the `files` container — see
  `../deploy/production/authentik/README.md`.
