# V4Career performance optimization

## Implemented in this build

- Added a bounded, in-process short-TTL response cache for expensive read-only endpoints: dashboard statistics (15s), dependent filter options (20s), source catalogs (15s), reports/job pages (8s), and dashboard trend (20s). Cache is disabled during tests, only serves authenticated GET requests, never stores non-200 responses, and exposes `X-V4Career-Cache: HIT|MISS` for verification.
- Optimized `/api/dashboard/stats` source metrics to count source rows and distinct job source IDs without a full `sources LEFT JOIN jobs` aggregation.
- Optimized `/api/reports/jobs` count queries to skip the `sources` join unless a source-type filter requires it.
- Rewrote today's dashboard job count as a timestamp range, allowing the `created_at` index to be used instead of wrapping the column in `DATE()`.
- Added targeted indexes for source-scoped report ordering, source-scoped created dates, experience filtering, and recent scraper runs in the database schema files.
- Added existing-database index scripts under `database/performance_indexes_postgres.sql` and `database/performance_indexes_mysql.sql`. They do not delete or alter job records.
- Kept MySQL/PostgreSQL compatibility and existing API response shapes. No live database was contacted and no migration or data changes were run.

## Deployment and verification

1. Back up the current branch and database before deployment.
2. Deploy the code first. No environment-variable or database-provider changes are required.
3. For an existing PostgreSQL/Neon database, review and run `database/performance_indexes_postgres.sql` once.
4. For an existing MySQL database, check `SHOW INDEX FROM jobs;` and `SHOW INDEX FROM collection_runs;`, then run only missing index statements from `database/performance_indexes_mysql.sql`.
5. Test dashboard, portal, filters, company sources, reports, and exports.
6. On repeated identical API requests within the TTL, check response header `X-V4Career-Cache: HIT`. First request should normally report `MISS`.
7. Check Render logs for `PERF api` and `PERF db` timing entries. Use the slowest endpoint/query logs to decide any next index or query change.

## Limitations

- Cache is per application process; each Gunicorn worker has its own cache. This avoids a Redis dependency and works on free hosting, but it is not shared across workers/instances.
- Cached counts can be up to the endpoint TTL out of date. This is intentional for fast dashboard navigation; a new scrape may take up to 20 seconds to appear in cached dashboard/facet responses.
- Leading-wildcard searches such as `%keyword%` generally cannot use ordinary B-tree indexes efficiently. A future search-specific design (PostgreSQL trigram/full-text or a MySQL full-text strategy) should be based on actual query timings and desired search semantics.
- Free hosting/database cold starts and cross-region latency remain outside the code's control. Keep Render and Neon in nearby regions if Neon is used.
- Automated tests could not be fully executed in this environment because Flask is not installed in the available Python runtime. Python syntax compilation and source-level checks are performed before delivery; run `pip install -r requirements.txt` then `python -m unittest discover -s tests -v` locally or in CI.


## MySQL connection-pool exhaustion fix (2026-10-23)

The local startup trace showed `mysql.connector.errors.PoolError: Failed getting connection; pool exhausted` while the browser issued several API requests concurrently. The default MySQL pool size is now 10 (configurable with `DB_POOL_SIZE`, capped at 20). If `.env` already sets `DB_POOL_SIZE=5`, change it to `DB_POOL_SIZE=10` and restart Flask. Keep the value within the connection limit of the MySQL provider; this setting does not migrate or modify database data.

This addresses the likely concurrency-related pool exhaustion. Verify by reloading the dashboard and confirming `/api/reports/jobs` returns HTTP 200. If pool exhaustion continues, inspect other processes using the same database and the provider's connection limit before increasing the pool further.

## Follow-up UI request optimization (2026-10-23)

- Report overview data is now fetched when the Reports page is opened, not during every initial dashboard load.
- The report source selector reuses the source catalog already fetched by `loadSources()` rather than requesting `/api/sources` a second time.
- This avoids report-only dashboard-statistics and collection-run requests during initial dashboard startup. It does not change database records or schema.
- Validation: `node --check static/app.js` passed. Python API tests could not be run in this packaging environment because Flask is not installed; run the project's test suite in the existing virtual environment.
