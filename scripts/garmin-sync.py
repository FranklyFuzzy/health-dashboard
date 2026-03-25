#!/usr/bin/env python3
"""
Fetch daily health data from Garmin Connect and output JSON to stdout.
Usage: python3 scripts/garmin-sync.py --days 1
"""

import argparse
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
from garminconnect import Garmin

load_dotenv()

TOKEN_DIR = os.path.expanduser("~/.garminconnect")


def get_client() -> Garmin:
    email = os.getenv("GARMIN_EMAIL", "")
    password = os.getenv("GARMIN_PASSWORD", "")
    client = Garmin(email, password)
    client.login(TOKEN_DIR)
    return client


def fetch_day(client: Garmin, day: date) -> dict:
    day_str = day.isoformat()

    # Daily summary (steps, calories)
    try:
        stats = client.get_stats(day_str)
    except Exception:
        stats = {}

    # Sleep data
    try:
        sleep = client.get_sleep_data(day_str)
        sleep_summary = sleep.get("dailySleepDTO", {}) if sleep else {}
    except Exception:
        sleep_summary = {}

    # Activities for workout calories
    try:
        activities = client.get_activities_by_date(day_str, day_str)
    except Exception:
        activities = []

    # Extract values with null safety
    active_cal = stats.get("activeKilocalories") or 0
    total_cal = stats.get("totalKilocalories") or 0
    steps = stats.get("totalSteps") or 0

    sleep_seconds = sleep_summary.get("sleepTimeSeconds") or 0
    sleep_hours = round(sleep_seconds / 3600, 1) if sleep_seconds else 0
    sleep_score = sleep_summary.get("overallScore") or 0

    # Body battery highest as readiness proxy
    readiness = stats.get("bodyBatteryHighestValue") or 0

    # Sum workout calories/duration from activities
    workout_cal = 0
    workout_duration_sec = 0
    workout_names = []
    for a in (activities or []):
        workout_cal += (a.get("calories") or 0)
        workout_duration_sec += (a.get("duration") or 0)
        name = a.get("activityName")
        if name:
            workout_names.append(name)

    return {
        "day": day_str,
        "active_calories": active_cal,
        "total_calories": total_cal,
        "steps": steps,
        "sleep_hours": sleep_hours,
        "sleep_score": sleep_score,
        "readiness_score": readiness,
        "garmin_workout_calories": round(workout_cal),
        "garmin_workout_duration_min": round(workout_duration_sec / 60) if workout_duration_sec else 0,
        "garmin_workout_name": ", ".join(workout_names) if workout_names else None,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=1)
    args = parser.parse_args()

    try:
        client = get_client()
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

    results = []
    today = date.today()
    for i in range(args.days):
        day = today - timedelta(days=i)
        try:
            results.append(fetch_day(client, day))
        except Exception as e:
            print(f"Warning: failed to fetch {day}: {e}", file=sys.stderr)

    print(json.dumps(results))


if __name__ == "__main__":
    main()
