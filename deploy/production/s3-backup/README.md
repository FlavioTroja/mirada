# Backup notturno su S3

Il servizio `backup` nel compose di produzione. Fa una cosa sola: ogni notte un
`pg_dump` del database e lo carica su S3.

## Stato attuale — è PREDISPOSTO, non attivo

Il servizio è dichiarato sotto `profiles: ["backup"]`, quindi **non parte** con
un `docker compose up -d`. Restano da fare tre cose, in quest'ordine:

1. **clonare l'immagine di backup sul server**, che il compose costruisce da un
   contesto locale:

   ```bash
   cd /home/manager/orch
   git clone https://github.com/overzoomit/oz-backup-s3.git
   ```

   Va lasciato intatto perché resti aggiornabile con `git pull`: di quel
   repository qui si usa **solo il contesto di build** (`backup-s3/`). Il suo
   `docker-compose.yml` è un esempio — tira su mysql, mongo e postgres finti —
   e **non si usa**;

2. **compilare `s3-backup/.env`** partendo da `.env.example`, credenziali S3
   comprese, con permessi `600`;

3. **accenderlo**:

   ```bash
   cd /home/manager/orch/mirada/production
   docker compose --profile backup up -d backup
   ```

> ⚠️ Il profilo non si "ricorda". Da quel momento ogni comando che riguarda
> questo servizio va dato con `--profile backup`, altrimenti non lo vede:
> `docker compose ps` senza il flag mostra tutto **tranne** il backup, e sembra
> che non ci sia.

> ⚠️ Il workflow di deploy **non tocca** questo servizio: distribuisce solo
> `backend`, `app` e `www`. Se cambi la sua definizione o il suo `.env`, serve
> un `docker compose --profile backup up -d backup` a mano — altrimenti il
> container continua con la definizione vecchia e niente lo dice.

## Verificare che stia davvero salvando

Un backup che non è mai stato **ripristinato** non è un backup: è un file.

```bash
docker compose --profile backup logs --tail 50 backup
ls -l s3-backup/logs/
```

E almeno una volta, la prova che conta: scaricare l'ultimo dump da S3 e
ripristinarlo su un database vuoto (procedura nel README di produzione, §3).
