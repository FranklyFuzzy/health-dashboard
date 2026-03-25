#!/bin/bash
# Daily sync cron job for Health Dashboard
# Add to crontab (e.g. daily at 3am):
#   0 3 * * * /path/to/health-dashboard/scripts/sync-cron.sh
curl -s -X POST http://localhost:3000/api/sync-all \
  -H "Content-Type: application/json" \
  -d '{"days": 1}'
