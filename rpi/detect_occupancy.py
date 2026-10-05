#!/usr/bin/env python3
"""
LibraSense - Raspberry Pi Camera Occupancy Detection Edge Client
Production-ready Python client with OpenCV lightweight detection and HMAC-SHA256 authentication.
"""

import os
import time
import json
import uuid
import hmac
import hashlib
from datetime import datetime, timezone
import requests
import cv2

# Configuration Settings
DEVICE_ID = os.getenv("DEVICE_ID", "dev_rpi_01")
DEVICE_SECRET = os.getenv("IOT_DEVICE_SECRET_KEY", "librasense_iot_hmac_secret_2026")
API_ENDPOINT = os.getenv("API_ENDPOINT", "http://localhost:3000/api/v1/iot/occupancy")
FRAME_INTERVAL_SECONDS = int(os.getenv("FRAME_INTERVAL_SECONDS", "5"))
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))


def initialize_detector():
    """Initializes OpenCV HOG Person Detector for lightweight CPU inference."""
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    return hog


def detect_person_in_frame(frame, hog_detector):
    """
    Evaluates presence of a person in the given frame.
    Returns: (is_occupied: bool, confidence: float)
    """
    if frame is None:
        return False, 0.0

    # Resize frame for efficient low-latency CPU processing
    small_frame = cv2.resize(frame, (480, 360))
    gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)

    # Detect people bounding boxes and weights
    boxes, weights = hog_detector.detectMultiScale(
        gray,
        winStride=(8, 8),
        padding=(4, 4),
        scale=1.05
    )

    if len(boxes) > 0 and len(weights) > 0:
        max_weight = float(max(weights))
        # Normalize SVM weight (typically 0.2 - 1.5) to a [0.5, 0.98] confidence range
        normalized_confidence = min(0.98, max(0.50, round(0.5 + (max_weight * 0.35), 3)))
        return True, normalized_confidence

    return False, 0.95  # Confident seat is empty


def sign_payload(device_id, timestamp_iso, nonce, payload_str, secret):
    """Generates HMAC-SHA256 signature matching backend validation."""
    data = f"{device_id}:{timestamp_iso}:{nonce}:{payload_str}"
    return hmac.new(secret.encode("utf-8"), data.encode("utf-8"), hashlib.sha256).hexdigest()


def send_telemetry(is_occupied, confidence):
    """Constructs signed payload and transmits to backend ingestion endpoint."""
    timestamp_iso = datetime.now(timezone.utc).isoformat()
    nonce = f"nonce_{uuid.uuid4().hex[:12]}"

    payload_dict = {
        "occupied": is_occupied,
        "confidence": confidence,
    }
    payload_json = json.dumps(payload_dict)
    signature = sign_payload(DEVICE_ID, timestamp_iso, nonce, payload_json, DEVICE_SECRET)

    headers = {
        "Content-Type": "application/json",
        "X-Device-ID": DEVICE_ID,
        "X-Device-Timestamp": timestamp_iso,
        "X-Device-Nonce": nonce,
        "X-Device-Signature": signature,
    }

    try:
        response = requests.post(API_ENDPOINT, data=payload_json, headers=headers, timeout=4)
        if response.status_code == 200:
            res_data = response.json()
            status_tag = "OCCUPIED" if res_data.get("data", {}).get("occupied") else "AVAILABLE"
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Telemetry synced -> Seat: {res_data.get('data', {}).get('seatId')} | State: {status_tag} | Conf: {confidence}")
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Telemetry rejected ({response.status_code}): {response.text}")
    except requests.exceptions.RequestException as err:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Connection error transmitting telemetry: {err}")


def main_loop():
    """Main camera capture and transmission loop."""
    print(f"Starting LibraSense Edge Camera Detection on Device '{DEVICE_ID}'...")
    hog = initialize_detector()
    cap = cv2.VideoCapture(CAMERA_INDEX)

    if not cap.isOpened():
        print(f"Warning: Camera index {CAMERA_INDEX} could not be opened. Falling back to simulation mode.")

    try:
        while True:
            if cap.isOpened():
                ret, frame = cap.read()
                if ret:
                    is_occupied, confidence = detect_person_in_frame(frame, hog)
                    send_telemetry(is_occupied, confidence)
                else:
                    print("Warning: Failed to grab camera frame.")
            else:
                # Standalone demo fallback if no camera hardware connected
                send_telemetry(False, 0.95)

            time.sleep(FRAME_INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("\nStopping LibraSense Edge Camera detection.")
    finally:
        if cap.isOpened():
            cap.release()


if __name__ == "__main__":
    main_loop()
