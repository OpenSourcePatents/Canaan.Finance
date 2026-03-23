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
import io
import time
import random
import argparse
from datetime import datetime, timedelta
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# Try importing pdfplumber for PDF extraction
try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    print("[!] pdfplumber not installed. Install with: pip install pdfplumber")
    print("[!] PDF minutes will not be parseable without it.")

BASE_URL = "https://www.canaannh.gov"
AGENDA_CENTER = f"{BASE_URL}/AgendaCenter"

# Realistic browser headers to avoid Cloudflare blocks
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

# Delay between requests (seconds) — randomized to look human
MIN_DELAY = 3
MAX_DELAY = 6

# Known officials and staff to track for attendance
TRACKED_OFFICIALS = [
    "Stephen Freese", "Scott Johnston", "Sadie Wells",
    "Jack Wozmak", "Chet Hagenbarth",
    "Ann Labrie", "Cariann Zandell", "Monica Rowe",
    "Christopher Olsen", "Christopher Olson",
    "Deb Tenney", "Pam Woollaber", "Pam Wollaber",
    "Hue Wetherbee", "Bob Souza",
]


def polite_sleep():
    """Sleep a random amount between requests to avoid rate limiting."""
    delay = random.uniform(MIN_DELAY, MAX_DELAY)
    time.sleep(delay)


def safe_request(url, max_retries=3):
    """Make a request with retries and exponential backoff."""
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            if resp.status_code == 403:
                wait = (attempt + 1) * 30
                print(f"    [!] 403 Forbidden. Waiting {wait}s before retry ({attempt+1}/{max_retries})...")
                time.sleep(wait)
                continue
            if resp.status_code == 429:
                wait = (attempt + 1) * 60
                print(f"    [!] Rate limited. Waiting {wait}s before retry ({attempt+1}/{max_retries})...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 15
                print(f"    [!] Request error: {e}. Waiting {wait}s before retry ({attempt+1}/{max_retries})...")
                time.sleep(wait)
            else:
                print(f"    [!] Failed after {max_retries} attempts: {e}")
                return None
    return None


def fetch_agenda_center():
    """Fetch the main AgendaCenter page and extract all minutes links."""
    print("[*] Fetching AgendaCenter index...")
    resp = safe_request(AGENDA_CENTER)
    if not resp:
        print("[!] Could not fetch AgendaCenter. Exiting.")
        sys.exit(1)
    return resp.text


def extract_minutes_links(html):
    """Parse the AgendaCenter HTML for all minutes download links."""
    soup = BeautifulSoup(html, "html.parser")
    minutes_links = []

    for link in soup.find_all("a", href=True):
        href = link["href"]
        if "/AgendaCenter/ViewFile/Minutes/" in href:
            full_url = urljoin(BASE_URL, href)

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

            committee = find_committee_for_link(link)
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
        agenda_link = row.find("a", href=lambda h: h and "ViewFile/Agenda" in h if h else False)
        if agenda_link:
            return agenda_link.get_text(strip=True)
    return None


def extract_text_from_pdf(content_bytes):
    """Extract text from PDF bytes using pdfplumber."""
    if not HAS_PDFPLUMBER:
        return None

    try:
        with pdfplumber.open(io.BytesIO(content_bytes)) as pdf:
            text_parts = []
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            return "\n".join(text_parts) if text_parts else None
    except Exception as e:
        print(f"    [!] PDF extraction error: {e}")
        return None


def clean_text(text):
    """Remove null bytes and other problematic characters."""
    if not text:
        return text
    text = text.replace("\x00", "")
    text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f]', '', text)
    return text


def fetch_and_parse_minutes(url):
    """Fetch a single minutes document and extract structured data."""
    resp = safe_request(url)
    if not resp:
        return None

    try:
        content_type = resp.headers.get("Content-Type", "").lower()
        text = None

        # Check if response is PDF
        if "application/pdf" in content_type or resp.content[:5] == b"%PDF-":
            print(f"    [PDF] Extracting text...")
            text = extract_text_from_pdf(resp.content)
            if not text:
                print(f"    [!] Could not extract text from PDF")
                return None
        else:
            text = resp.text
            if "<html" in text.lower() or "<body" in text.lower():
                soup = BeautifulSoup(text, "html.parser")
                text = soup.get_text(separator="\n")

        text = clean_text(text)

        if not text or len(text.strip()) < 50:
            print(f"    [!] Extracted text too short ({len(text.strip()) if text else 0} chars)")
            return None

        return parse_minutes_text(text, url)

    except Exception as e:
        print(f"  [!] Error parsing {url}: {e}")
        return None


def parse_minutes_text(text, source_url):
    """Parse the raw text of meeting minutes for structured data."""
    result = {
        "start_time": None,
        "end_time": None,
        "duration_minutes": None,
        "attendees": [],
        "officials_present": [],
        "source_url": source_url,
    }

    lines = text.strip().split("\n")
    if not lines:
        return result

    # Parse attendees from header
    attendee_text = ""
    capturing = False
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        upper = line_stripped.upper()

        if any(keyword in upper for keyword in ["MINUTES", "CALL TO ORDER"]):
            if capturing:
                break
            if "CALL TO ORDER" in upper:
                break
            continue

        if i >= 2 and (":" in line_stripped or capturing):
            capturing = True
            attendee_text += " " + line_stripped

    all_names = extract_names_from_attendee_line(attendee_text)
    result["attendees"] = all_names

    result["officials_present"] = [
        name for name in TRACKED_OFFICIALS
        if any(name.lower() in a.lower() for a in all_names)
    ]

    # Parse start time
    start_match = re.search(
        r"(?:call(?:ed)?.*?to order|meeting.*?(?:began|opened|started)).*?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))",
        text, re.IGNORECASE | re.DOTALL
    )
    if start_match:
        result["start_time"] = normalize_time(start_match.group(1))

    # Parse end time
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
            if 0 < diff < 600:
                result["duration_minutes"] = int(diff)
        except ValueError:
            pass

    return result


def extract_names_from_attendee_line(text):
    """Extract individual names from the attendee/header text."""
    names = []
    segments = re.split(r"[;]", text)
    for segment in segments:
        if ":" in segment:
            segment = segment.split(":", 1)[1]
        segment = re.sub(r"\b(TA|Recorded by|Public)\b", ",", segment, flags=re.IGNORECASE)
        parts = re.split(r"[,]|\band\b", segment)
        for part in parts:
            name = part.strip().strip(".")
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

    print(f"[*] Scraping {len(links)} minutes documents (with {MIN_DELAY}-{MAX_DELAY}s delay between requests)...")

    records = []
    for i, link in enumerate(links):
        print(f"  [{i+1}/{len(links)}] {link['committee']} — {link['date']} — {link['title'] or 'untitled'}")

        # Polite delay between requests
        if i > 0:
            polite_sleep()

        parsed = fetch_and_parse_minutes(link["url"])
        if parsed:
            record = {
                "meeting_date": link["date"],
                "committee": clean_text(link["committee"]),
                "title": clean_text(link["title"]),
                "agenda_id": link["agenda_id"],
                "start_time": parsed["start_time"],
                "end_time": parsed["end_time"],
                "duration_minutes": parsed["duration_minutes"],
                "attendees": parsed["attendees"],
                "officials_present": parsed["officials_present"],
                "source_url": parsed["source_url"],
            }
            records.append(record)
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

    rows = []
    for r in records:
        rows.append({
            "town_id": 1,
            "meeting_date": r["meeting_date"],
            "committee": clean_text(r["committee"]),
            "title": clean_text(r["title"]),
            "agenda_id": r["agenda_id"],
            "start_time": r["start_time"],
            "end_time": r["end_time"],
            "duration_minutes": r["duration_minutes"],
            "attendees": r["attendees"],
            "officials_present": r["officials_present"],
            "source_url": r["source_url"],
        })

    endpoint = f"{url}/rest/v1/meeting_records"

    # Push in batches of 5 to avoid payload issues
    batch_size = 5
    total_pushed = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        resp = requests.post(endpoint, headers=headers, json=batch)

        if resp.status_code in (200, 201):
            total_pushed += len(batch)
            print(f"  [*] Pushed batch {i//batch_size + 1} ({len(batch)} records)")
        else:
            print(f"  [!] Supabase error {resp.status_code} on batch {i//batch_size + 1}: {resp.text}")
            # Try individual records to find the problem one
            for j, row in enumerate(batch):
                single_resp = requests.post(endpoint, headers=headers, json=[row])
                if single_resp.status_code in (200, 201):
                    total_pushed += 1
                else:
                    print(f"    [!] Failed: {row['meeting_date']} {row['committee']}: {single_resp.text}")

    print(f"[*] Pushed {total_pushed}/{len(rows)} records to Supabase")


def main():
    parser = argparse.ArgumentParser(description="Scrape Canaan meeting minutes")
    parser.add_argument("--push", action="store_true", help="Push results to Supabase")
    parser.add_argument("--committee", type=str, help="Filter by committee name (partial match)")
    parser.add_argument("--year", type=int, help="Filter by year")
    parser.add_argument("--output", type=str, default="meeting_records.json", help="Output JSON file")
    args = parser.parse_args()

    records = scrape_all(committee_filter=args.committee, year_filter=args.year)

    with open(args.output, "w") as f:
        json.dump(records, f, indent=2, default=str)
    print(f"[*] Wrote {len(records)} records to {args.output}")

    if args.push:
        push_to_supabase(records)


if __name__ == "__main__":
    main()
