#!/usr/bin/env python3
"""
Canaan Finance — Meeting Minutes Scraper
Scrapes canaannh.gov/AgendaCenter for all board/committee meeting minutes.
Extracts: date, committee, start time, end time, duration, attendees, source URL.
Outputs JSON and optionally pushes to Supabase.

Usage:
  python scrape_minutes.py                    # scrape all, output JSON
  python scrape_minutes.py --push             # scrape all, push to Supabase
  python scrape_minutes.py --committee select # scrape only Select Board
  python scrape_minutes.py --year 2026        # scrape only 2026
"""

import re
import json
import sys
import os
import argparse
from datetime import datetime, timedelta
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.canaannh.gov"
AGENDA_CENTER = f"{BASE_URL}/AgendaCenter"

# Known officials and staff to track for attendance
TRACKED_OFFICIALS = [
    "Stephen Freese", "Scott Johnston", "Sadie Wells",
    "Jack Wozmak", "Chet Hagenbarth",
    "Ann Labrie", "Cariann Zandell", "Monica Rowe",
    "Christopher Olsen", "Christopher Olson",
    "Deb Tenney", "Pam Woollaber", "Pam Wollaber",
    "Hue Wetherbee", "Bob Souza",
]

# Committee category IDs from CivicPlus AgendaCenter
# These map to the category dropdown on the page
COMMITTEES = {
    "Budget Committee": 2,
    "Capital Improvement Committee": 4,
    "Cemetery Trustees Committee": 15,
    "Conservation Commission": 12,
    "Economic Development Committee": 5,
    "Historic District Commission": 6,
    "Meetinghouse Preservation Committee": 14,
    "Museum Curators": 7,
    "Planning Board": 8,
    "Select Board": 9,
    "Source Water Protection Committee": 10,
    "Trustees of the Trust Funds": 11,
    "Water & Sewer": 13,
}


def fetch_agenda_center():
    """Fetch the main AgendaCenter page and extract all minutes links."""
    print("[*] Fetching AgendaCenter index...")
    resp = requests.get(AGENDA_CENTER, timeout=30)
    resp.raise_for_status()
    return resp.text


def extract_minutes_links(html):
    """Parse the AgendaCenter HTML for all minutes download links."""
    soup = BeautifulSoup(html, "html.parser")
    minutes_links = []

    # Find all links that point to ViewFile/Minutes
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if "/AgendaCenter/ViewFile/Minutes/" in href:
            full_url = urljoin(BASE_URL, href)

            # Try to extract date and ID from URL pattern: _MMDDYYYY-ID
            match = re.search(r"_(\d{8})-(\d+)", href)
            if match:
                date_str = match.group(1)
                agenda_id = match.group(2)
                try:
                    meeting_date = datetime.strptime(date_str, "%m%d%Y").date()
                except ValueError:
                    meeting_date = None
            else:
                meeting_date = None
                agenda_id = None

            # Walk up to find the committee name from the section header
            committee = find_committee_for_link(link)

            # Find the meeting title from the adjacent agenda link
            title = find_meeting_title(link)

            minutes_links.append({
                "url": full_url,
                "date": meeting_date.isoformat() if meeting_date else None,
                "agenda_id": agenda_id,
                "committee": committee,
                "title": title,
            })

    print(f"[*] Found {len(minutes_links)} minutes documents")
    return minutes_links


def find_committee_for_link(link_element):
    """Walk up the DOM to find which committee section this link belongs to."""
    element = link_element
    for _ in range(20):
        element = element.parent
        if element is None:
            break
        # Look for h2 headers that name the committee
        prev = element.find_previous_sibling("h2")
        if prev:
            return prev.get_text(strip=True)
    return "Unknown"


def find_meeting_title(link_element):
    """Find the meeting title associated with this minutes link."""
    row = link_element
    for _ in range(10):
        row = row.parent
        if row is None:
            break
        # Look for the main agenda link in the same row
        agenda_link = row.find("a", href=lambda h: h and "ViewFile/Agenda" in h if h else False)
        if agenda_link:
            return agenda_link.get_text(strip=True)
    return None


def fetch_and_parse_minutes(url):
    """Fetch a single minutes document and extract structured data."""
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        text = resp.text

        # If it's HTML, extract text content
        if "<html" in text.lower() or "<body" in text.lower():
            soup = BeautifulSoup(text, "html.parser")
            text = soup.get_text(separator="\n")

        return parse_minutes_text(text, url)

    except Exception as e:
        print(f"  [!] Error fetching {url}: {e}")
        return None


def parse_minutes_text(text, source_url):
    """Parse the raw text of meeting minutes for structured data."""
    result = {
        "start_time": None,
        "end_time": None,
        "duration_minutes": None,
        "attendees": [],
        "officials_present": [],
        "raw_header": None,
        "source_url": source_url,
    }

    lines = text.strip().split("\n")
    if not lines:
        return result

    # Extract header block (first ~10 lines usually have attendees)
    header_block = "\n".join(lines[:15])
    result["raw_header"] = header_block

    # Parse attendees from header
    # Format: "Select Board: Name1, Name2, Name3; Role: Name4, Name5"
    attendee_line = ""
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        # Attendee block usually starts after the location line
        # and before "MINUTES" or "1. Call to Order"
        if any(keyword in line_stripped.upper() for keyword in ["MINUTES", "CALL TO ORDER"]):
            break
        if ":" in line_stripped and i > 1:
            attendee_line += " " + line_stripped

    # Extract all names from attendee line
    all_names = extract_names_from_attendee_line(attendee_line)
    result["attendees"] = all_names

    # Match against tracked officials
    result["officials_present"] = [
        name for name in TRACKED_OFFICIALS
        if any(name.lower() in a.lower() for a in all_names)
    ]

    # Parse start time — "called the meeting to order at X:XX PM"
    start_match = re.search(
        r"(?:call(?:ed)?.*?to order|meeting.*?(?:began|opened|started)).*?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))",
        text, re.IGNORECASE
    )
    if start_match:
        result["start_time"] = normalize_time(start_match.group(1))

    # Parse end time — "adjourn.*at X:XX PM" or "meeting adjourned at X:XX PM"
    # Use DOTALL to handle line breaks between "adjourn" and the time
    adjourn_match = re.search(
        r"adjourn.*?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))",
        text, re.IGNORECASE | re.DOTALL
    )
    if adjourn_match:
        result["end_time"] = normalize_time(adjourn_match.group(1))

    # Calculate duration
    if result["start_time"] and result["end_time"]:
        try:
            fmt = "%I:%M %p"
            start = datetime.strptime(result["start_time"], fmt)
            end = datetime.strptime(result["end_time"], fmt)
            if end < start:
                end += timedelta(hours=12)
            diff = (end - start).total_seconds() / 60
            if 0 < diff < 600:  # sanity check: less than 10 hours
                result["duration_minutes"] = int(diff)
        except ValueError:
            pass

    return result


def extract_names_from_attendee_line(text):
    """Extract individual names from the attendee/header text."""
    names = []
    # Remove role prefixes like "Select Board:", "TA", "Public:"
    # Split on semicolons first (separates role groups)
    segments = re.split(r"[;]", text)
    for segment in segments:
        # Remove the role label before the colon
        if ":" in segment:
            segment = segment.split(":", 1)[1]
        # Remove common prefixes
        segment = re.sub(r"\b(TA|Recorded by|Public)\b", ",", segment, flags=re.IGNORECASE)
        # Split on commas and "and"
        parts = re.split(r"[,]|\band\b", segment)
        for part in parts:
            name = part.strip().strip(".")
            # Basic name validation: 2+ words, no weird chars
            if name and len(name.split()) >= 2 and len(name) < 40:
                if not re.search(r"[0-9@#$%]", name):
                    names.append(name)
    return names


def normalize_time(time_str):
    """Normalize time string to consistent format."""
    time_str = time_str.strip().upper()
    try:
        t = datetime.strptime(time_str, "%I:%M %p")
        return t.strftime("%I:%M %p")
    except ValueError:
        try:
            t = datetime.strptime(time_str.replace(" ", ""), "%I:%M%p")
            return t.strftime("%I:%M %p")
        except ValueError:
            return time_str


def scrape_all(committee_filter=None, year_filter=None):
    """Main scrape function. Returns list of parsed meeting records."""
    html = fetch_agenda_center()
    links = extract_minutes_links(html)

    if committee_filter:
        links = [l for l in links if committee_filter.lower() in (l["committee"] or "").lower()]

    if year_filter:
        links = [l for l in links if l["date"] and l["date"].startswith(str(year_filter))]

    print(f"[*] Scraping {len(links)} minutes documents...")

    records = []
    for i, link in enumerate(links):
        print(f"  [{i+1}/{len(links)}] {link['committee']} — {link['date']} — {link['title'] or 'untitled'}")
        parsed = fetch_and_parse_minutes(link["url"])
        if parsed:
            record = {
                "meeting_date": link["date"],
                "committee": link["committee"],
                "title": link["title"],
                "agenda_id": link["agenda_id"],
                **parsed,
            }
            records.append(record)
            # Brief summary
            dur = f"{record['duration_minutes']}min" if record["duration_minutes"] else "unknown duration"
            officials = ", ".join(record["officials_present"][:3]) or "none tracked"
            print(f"         {record['start_time'] or '?'} — {record['end_time'] or '?'} ({dur}) | Officials: {officials}")

    print(f"\n[*] Successfully parsed {len(records)} meeting records")
    return records


def push_to_supabase(records):
    """Push parsed records to Supabase meeting_records table."""
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

    if not url or not key:
        print("[!] SUPABASE_URL and SUPABASE_SERVICE_KEY required for --push")
        sys.exit(1)

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    # Upsert records
    rows = []
    for r in records:
        rows.append({
            "town_id": 1,
            "meeting_date": r["meeting_date"],
            "committee": r["committee"],
            "title": r["title"],
            "agenda_id": r["agenda_id"],
            "start_time": r["start_time"],
            "end_time": r["end_time"],
            "duration_minutes": r["duration_minutes"],
            "attendees": r["attendees"],
            "officials_present": r["officials_present"],
            "source_url": r["source_url"],
        })

    endpoint = f"{url}/rest/v1/meeting_records"
    resp = requests.post(endpoint, headers=headers, json=rows)

    if resp.status_code in (200, 201):
        print(f"[*] Pushed {len(rows)} records to Supabase")
    else:
        print(f"[!] Supabase error {resp.status_code}: {resp.text}")


def main():
    parser = argparse.ArgumentParser(description="Scrape Canaan meeting minutes")
    parser.add_argument("--push", action="store_true", help="Push results to Supabase")
    parser.add_argument("--committee", type=str, help="Filter by committee name (partial match)")
    parser.add_argument("--year", type=int, help="Filter by year")
    parser.add_argument("--output", type=str, default="meeting_records.json", help="Output JSON file")
    args = parser.parse_args()

    records = scrape_all(committee_filter=args.committee, year_filter=args.year)

    # Always write JSON output
    with open(args.output, "w") as f:
        json.dump(records, f, indent=2, default=str)
    print(f"[*] Wrote {len(records)} records to {args.output}")

    if args.push:
        push_to_supabase(records)


if __name__ == "__main__":
    main()
