-- FASE C — `reservedFor` entra nell'identità della quota.
--
-- SCOSTAMENTO DICHIARATO DAL backend-brief §3.6, motivato dal §4.8.
-- La terna del §3.6 è `(eventId, scope, scopeId, role)`, ma il §4.8 indirizza il
-- contingente degli accrediti come `quota(EVENT, null, reservedFor: COMPLIMENTARY)`
-- — ambito EVENT, `scopeId` e `role` nulli: **la stessa terna della capienza della
-- sala**. Con la terna letterale le due righe non possono coesistere, e il ramo
-- accrediti del §4.8 (con il caso di test T19) sarebbe irrealizzabile; lo stesso
-- vale per il contingente `EXTERNAL_CHANNEL` dell'assunzione AS-4.
-- Il vincolo resta un SOVRAINSIEME di quello del §3.6.
--
-- Come nella migrazione precedente l'indice è creato con NULLS NOT DISTINCT: con
-- la semantica PostgreSQL di serie due quote di capienza della sala (tutti NULL
-- salvo l'evento) non entrerebbero in conflitto, e `05` §2.1 resterebbe lettera
-- morta proprio sulla quota più importante.

-- DropIndex
DROP INDEX "CapacityQuota_eventId_scope_scopeId_role_key";

-- CreateIndex
CREATE UNIQUE INDEX "CapacityQuota_eventId_scope_scopeId_role_reservedFor_key"
    ON "CapacityQuota" ("eventId", "scope", "scopeId", "role", "reservedFor") NULLS NOT DISTINCT;
