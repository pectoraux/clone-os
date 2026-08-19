#!/bin/bash
# Watchdog: restart Next.js dev server if it dies.
cd /home/z/my-project
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date)] next-server down, restarting..." >> /home/z/my-project/watchdog.log
    nohup ./node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
    disown
    sleep 8
  fi
  sleep 3
done
