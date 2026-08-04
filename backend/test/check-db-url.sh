#!/bin/sh
# 💀 Safety check to prevent accidental data loss on remote databases
if echo "$DATABASE_URL" | grep -qvE "localhost|127\.0\.0\.1"; then
  echo "ERROR: DATABASE_URL does not point to localhost. Aborting to prevent accidental data loss."
  echo "DATABASE_URL: $DATABASE_URL"
  exit 1
fi