#!/usr/bin/env python3
"""
Garmin Connect Health Data Exporter
Exports activities, daily stats, and weight data to CSV files.
Reads credentials from .env file for security.
"""

import csv
import json
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from garminconnect import Garmin

# --- Load Config from .env ---
ENV_PATH = os.path.expanduser("~/ai-server/health-data/.env")
load_dotenv(ENV_PATH)

EMAIL = os.getenv("GARMIN_EMAIL")
PASSWORD = os.getenv("GARMIN_PASSWORD")
OUTPUT_DIR = os.path.expanduser("~/ai-server/health-data")
DAILY_DIR = os.path.join(OUTPUT_DIR, "daily")
TOKEN_DIR = os.path.expanduser("~/.garminconnect")

# Use yesterday's date for the export (cron runs at 5:30 AM)
EXPORT_DATE = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

# Ensure directories exist
os.makedirs(DAILY_DIR, exist_ok=True)
os.makedirs(TOKEN_DIR, exist_ok=True)


def get_client():
    """Login to Garmin, reusing saved tokens when possible."""
    if not EMAIL or not PASSWORD:
        print("ERROR: GARMIN_EMAIL and GARMIN_PASSWORD must be set in .env file")
        exit(1)

    client = Garmin(EMAIL, PASSWORD)
    try:
        client.login(TOKEN_DIR)
    except Exception:
        try:
            client.login()
            client.garth.dump(TOKEN_DIR)
        except Exception as e:
            print(f"ERROR: Login failed: {e}")
            print("You may need to re-authenticate with MFA.")
            print("Run: python3 -c \"from garminconnect import Garmin; c=Garmin('{EMAIL}','{PASSWORD}',prompt_mfa=input); c.login(); c.garth.dump('{TOKEN_DIR}')\"")
            exit(1)
    return client


def write_csv(filepath, fields, rows, append=False):
    """Write rows to CSV, optionally appending."""
    mode = "a" if append else "w"
    file_exists = os.path.exists(filepath) and os.path.getsize(filepath) > 0

    with open(filepath, mode, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        if not file_exists or not append:
            writer.writeheader()
        writer.writerows(rows)


def export_activities(client, days=1):
    """Export recent activities to CSV."""
    end = datetime.now()
    start = end - timedelta(days=days)
    date_str = EXPORT_DATE

    activities = client.get_activities_by_date(
        start.strftime("%Y-%m-%d"),
        end.strftime("%Y-%m-%d")
    )

    if not activities:
        print(f"No activities found for last {days} day(s)")
        return

    fields = [
        "date", "activityName", "activityType",
        "distance_km", "duration_min", "calories",
        "averageHR", "maxHR", "averageSpeed",
        "steps", "elevationGain"
    ]

    rows = []
    for activity in activities:
        rows.append({
            "date": activity.get("startTimeLocal", ""),
            "activityName": activity.get("activityName", ""),
            "activityType": activity.get("activityType", {}).get("typeKey", ""),
            "distance_km": round(activity.get("distance", 0) / 1000, 2),
            "duration_min": round(activity.get("duration", 0) / 60, 1),
            "calories": activity.get("calories", 0),
            "averageHR": activity.get("averageHR", ""),
            "maxHR": activity.get("maxHR", ""),
            "averageSpeed": activity.get("averageSpeed", ""),
            "steps": activity.get("steps", ""),
            "elevationGain": activity.get("elevationGain", ""),
        })

    # Daily archive file
    write_csv(os.path.join(DAILY_DIR, f"activities_{date_str}.csv"), fields, rows)

    # Master file (append)
    write_csv(os.path.join(OUTPUT_DIR, "garmin_activities_all.csv"), fields, rows, append=True)

    print(f"Exported {len(rows)} activities")


def export_daily_stats(client, days=1):
    """Export daily health stats (steps, HR, stress, sleep)."""
    date_str = EXPORT_DATE

    fields = [
        "date", "totalSteps", "totalDistance_km", "activeCalories",
        "restingHeartRate", "minHeartRate", "maxHeartRate",
        "averageStressLevel", "maxStressLevel",
        "sleepTimeHours", "deepSleepHours", "lightSleepHours", "remSleepHours"
    ]

    rows = []
    for i in range(days):
        date = (datetime.strptime(EXPORT_DATE, "%Y-%m-%d") - timedelta(days=i)).strftime("%Y-%m-%d")

        try:
            stats = client.get_stats(date)
            sleep = client.get_sleep_data(date)
            sleep_summary = sleep.get("dailySleepDTO", {}) if sleep else {}

            rows.append({
                "date": date,
                "totalSteps": stats.get("totalSteps") or 0,
                "totalDistance_km": round((stats.get("totalDistanceMeters") or 0) / 1000, 2),
                "activeCalories": stats.get("activeKilocalories") or 0,
                "restingHeartRate": stats.get("restingHeartRate") or "",
                "minHeartRate": stats.get("minHeartRate") or "",
                "maxHeartRate": stats.get("maxHeartRate") or "",
                "averageStressLevel": stats.get("averageStressLevel") or "",
                "maxStressLevel": stats.get("maxStressLevel") or "",
                "sleepTimeHours": round((sleep_summary.get("sleepTimeSeconds") or 0) / 3600, 1),
                "deepSleepHours": round((sleep_summary.get("deepSleepSeconds") or 0) / 3600, 1),
                "lightSleepHours": round((sleep_summary.get("lightSleepSeconds") or 0) / 3600, 1),
                "remSleepHours": round((sleep_summary.get("remSleepSeconds") or 0) / 3600, 1),
            })
        except Exception as e:
            print(f"Error fetching stats for {date}: {e}")

    # Daily archive
    write_csv(os.path.join(DAILY_DIR, f"daily_stats_{date_str}.csv"), fields, rows)

    # Master file (append)
    write_csv(os.path.join(OUTPUT_DIR, "garmin_daily_stats_all.csv"), fields, rows, append=True)

    print(f"Exported {len(rows)} days of daily stats")


def export_weight(client, days=30):
    """Export weight/body composition data."""
    date_str = EXPORT_DATE
    end = datetime.now()
    start = end - timedelta(days=days)

    fields = ["date", "weight_kg", "weight_lbs", "bmi", "bodyFat", "bodyWater", "muscleMass_kg", "boneMass_kg"]

    try:
        data = client.get_body_composition(
            start.strftime("%Y-%m-%d"),
            end.strftime("%Y-%m-%d")
        )
        records = data.get("dateWeightList", [])

        if not records:
            print("No weight records found")
            return

        rows = []
        for record in records:
            weight_grams = record.get("weight", 0)
            weight_kg = round(weight_grams / 1000, 1) if weight_grams else 0
            weight_lbs = round(weight_kg * 2.20462, 1) if weight_kg else 0

            cal_date = record.get("calendarDate", "")
            if isinstance(cal_date, int):
                cal_date = datetime.fromtimestamp(cal_date / 1000).strftime("%Y-%m-%d")

            rows.append({
                "date": cal_date,
                "weight_kg": weight_kg,
                "weight_lbs": weight_lbs,
                "bmi": record.get("bmi", ""),
                "bodyFat": record.get("bodyFatPercentage", ""),
                "bodyWater": record.get("bodyWater", ""),
                "muscleMass_kg": round(record.get("muscleMass", 0) / 1000, 1) if record.get("muscleMass") else "",
                "boneMass_kg": round(record.get("boneMass", 0) / 1000, 1) if record.get("boneMass") else "",
            })

        # Daily archive
        write_csv(os.path.join(DAILY_DIR, f"weight_{date_str}.csv"), fields, rows)

        # Master file (overwrite — weight history is cumulative)
        write_csv(os.path.join(OUTPUT_DIR, "garmin_weight_all.csv"), fields, rows)

        print(f"Exported {len(rows)} weight records")

    except Exception as e:
        print(f"Error fetching weight data: {e}")


if __name__ == "__main__":
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting Garmin export...")
    client = get_client()
    export_activities(client, days=1)
    export_daily_stats(client, days=1)
    export_weight(client, days=30)
    print("Done!")
