Stop the app ( npm run dev / npm start ) so nothing is writing to the DB.
Copy the DB file to a backups folder.
```js
mkdir backups -ea 0
Copy-Item .\dev.db .\backups\dev_$(Get-Date -Format yyyyMMdd_HHmmss).db
```

If SQLite is using WAL mode, you may also see dev.db-wal and dev.db-shm . When the app is stopped, copying dev.db is usually enough, but copying all three is safest:
```js
Copy-Item .\dev.db, .\dev.db-wal, .\dev.db-shm .\backups\ -ErrorAction SilentlyContinue
```

Restore / “Import” the DB
```js
Copy-Item .\backups\dev_20260119_153000.db .\dev.db -Force
```

```js
npx prisma migrate deploy
```
