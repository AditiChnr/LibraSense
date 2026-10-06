#!/usr/bin/env python3
"""
LibraSense - Edge Camera Occupancy Detection Client
Supports both Raspberry Pi Edge Nodes and Local Laptop Webcam Testing.
Uses OpenCV for computer vision inference and HMAC-SHA256 for secure server-authoritative telemetry.
"""

import os
import sys
import time
import json
import uuid
import hmac
import hashlib
import argparse
from datetime import datetime, timezone
import requests
import cv2


def parse_arguments():
    """Parses command-line arguments with environment variable fallbacks."""
    parser = argparse.ArgumentParser(
        description="LibraSense IoT Occupancy Detection Client (Raspberry Pi & Laptop Webcam)"
    )
    parser.add_argument(
        "-c", "--camera",
        type=int,
        default=int(os.getenv("CAMERA_INDEX", "0")),
        help="Camera index for VideoCapture (default: 0 or env CAMERA_INDEX)"
    )
    parser.add_argument(
        "-u", "--api-url",
        type=str,
        default=os.getenv("API_ENDPOINT", os.getenv("API_BASE_URL", "http://localhost:3000/api/v1/iot/occupancy")),
        help="Target IoT ingestion endpoint URL (default: http://localhost:3000/api/v1/iot/occupancy)"
    )
    parser.add_argument(
        "-d", "--device-id",
        type=str,
        default=os.getenv("DEVICE_ID", "dev_rpi_01"),
        help="Registered IoT Device ID in Firestore (default: dev_rpi_01 or env DEVICE_ID)"
    )
    parser.add_argument(
        "-s", "--secret",
        type=str,
        default=os.getenv("IOT_DEVICE_SECRET_KEY", "librasense_iot_hmac_secret_2026"),
        help="Pre-shared HMAC Secret Key (default: env IOT_DEVICE_SECRET_KEY)"
    )
    parser.add_argument(
        "-i", "--interval",
        type=float,
        default=float(os.getenv("FRAME_INTERVAL_SECONDS", "3.0")),
        help="Telemetry transmission interval in seconds (default: 3.0s)"
    )
    parser.add_argument(
        "-p", "--preview",
        action="store_true",
        default=os.getenv("CAMERA_PREVIEW", "false").lower() in ("true", "1", "yes"),
        help="Display live camera preview window with detection bounding boxes"
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=float(os.getenv("CONFIDENCE_THRESHOLD", "0.80")),
        help="Minimum confidence threshold for occupancy detection (default: 0.80 or env CONFIDENCE_THRESHOLD)"
    )
    return parser.parse_args()


def initialize_detectors():
    """Initializes OpenCV HOG Person Detector and Face Cascade for desk-level occupancy detection."""
    # 1. HOG Person Detector (Full / upper body)
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

    # 2. Haar Cascade Face Detector (Ideal for close-up webcam desk monitoring)
    face_cascade = None
    try:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        if os.path.exists(cascade_path):
            face_cascade = cv2.CascadeClassifier(cascade_path)
    except Exception as err:
        print(f"[WARN] Haar Cascade not available: {err}")

    return hog, face_cascade


def detect_occupancy_in_frame(frame, hog, face_cascade, threshold: float = 0.80):
    """
    Evaluates presence of a person or student in front of the desk/camera.
    Returns: (is_occupied: bool, confidence: float, detections_boxes: list)
    """
    if frame is None:
        return False, 0.0, []

    # Downscale frame for fast, low-latency CPU processing
    small_frame = cv2.resize(frame, (640, 480))
    gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
    detected_boxes = []
    max_confidence = 0.0

    # 1. HOG Person Detection
    boxes, weights = hog.detectMultiScale(
        gray,
        winStride=(8, 8),
        padding=(4, 4),
        scale=1.05
    )
    if len(boxes) > 0 and len(weights) > 0:
        max_weight = float(max(weights))
        norm_conf = min(0.98, max(0.55, round(0.55 + (max_weight * 0.30), 2)))
        max_confidence = max(max_confidence, norm_conf)
        for (bx, by, bw, bh) in boxes:
            detected_boxes.append((bx, by, bw, bh, "Person"))

    # 2. Face Detection (especially responsive for close-up laptop webcams)
    if face_cascade is not None:
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(40, 40)
        )
        if len(faces) > 0:
            face_conf = 0.94
            max_confidence = max(max_confidence, face_conf)
            for (fx, fy, fw, fh) in faces:
                detected_boxes.append((fx, fy, fw, fh, "Face"))

    if len(detected_boxes) > 0 and max_confidence >= threshold:
        return True, max_confidence, detected_boxes

    return False, 0.95, []


def sign_payload(device_id: str, timestamp_iso: str, nonce: str, payload_str: str, secret: str) -> str:
    """Generates canonical HMAC-SHA256 signature matching backend validation."""
    canonical_data = f"{device_id}:{timestamp_iso}:{nonce}:{payload_str}"
    return hmac.new(secret.encode("utf-8"), canonical_data.encode("utf-8"), hashlib.sha256).hexdigest()


def send_telemetry(api_endpoint: str, device_id: str, device_secret: str, is_occupied: bool, confidence: float):
    """Transmits signed telemetry frame to backend IoT ingestion endpoint."""
    timestamp_iso = datetime.now(timezone.utc).isoformat()
    nonce = f"nonce_{uuid.uuid4().hex[:12]}"

    payload_dict = {
        "occupied": is_occupied,
        "confidence": confidence,
    }
    payload_json = json.dumps(payload_dict)
    signature = sign_payload(device_id, timestamp_iso, nonce, payload_json, device_secret)

    headers = {
        "Content-Type": "application/json",
        "X-Device-ID": device_id,
        "X-Device-Timestamp": timestamp_iso,
        "X-Device-Nonce": nonce,
        "X-Device-Signature": signature,
    }

    now_str = datetime.now().strftime("%H:%M:%S")
    status_label = "OCCUPIED" if is_occupied else "VACANT  "

    try:
        response = requests.post(api_endpoint, data=payload_json, headers=headers, timeout=4.0)
        if response.status_code == 200:
            res_json = response.json()
            assigned_seat = res_json.get("data", {}).get("seatId", "unassigned")
            smoothed_state = "OCCUPIED" if res_json.get("data", {}).get("occupied") else "AVAILABLE"
            smoothed_conf = res_json.get("data", {}).get("confidence", confidence)
            print(
                f"[{now_str}] DETECTION: {status_label} | CONFIDENCE: {confidence:.2f} | "
                f"TELEMETRY SENT -> HTTP 200 OK (Seat: {assigned_seat} | Smoothed: {smoothed_state} @ {smoothed_conf:.2f})"
            )
        else:
            print(f"[{now_str}] DETECTION: {status_label} | HTTP {response.status_code} ERROR: {response.text}")
    except requests.exceptions.RequestException as err:
        print(f"[{now_str}] DETECTION: {status_label} | CONNECTION ERROR: Could not reach {api_endpoint} ({err})")


def open_camera_stream(camera_index: int):
    """Opens video capture stream with Windows DirectShow fallback for laptop webcams."""
    # Try DirectShow backend on Windows first for fast startup
    if sys.platform.startswith("win"):
        cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
        if cap.isOpened():
            return cap

    # Standard V4L2 / Default backend
    cap = cv2.VideoCapture(camera_index)
    return cap


def main():
    args = parse_arguments()

    print("======================================================================")
    print("LibraSense IoT Occupancy Detector - Edge Client")
    print(f"Target Device ID : {args.device_id}")
    print(f"Camera Index     : {args.camera}")
    print(f"Ingestion Endpoint: {args.api_url}")
    print(f"Transmit Interval: {args.interval}s")
    print(f"Preview Window   : {'ENABLED (press q to quit)' if args.preview else 'DISABLED'}")
    print("======================================================================")

    hog, face_cascade = initialize_detectors()
    cap = open_camera_stream(args.camera)

    if not cap.isOpened():
        print(f"[ERROR] Camera index {args.camera} could not be opened.")
        print("[HINT] Ensure your laptop camera is not in use by another application (Zoom, Teams, etc.).")
        print("[HINT] You can try changing camera index using --camera 1")
        sys.exit(1)

    print(f"[{datetime.now().strftime('%H:%M:%S')}] CAMERA CONNECTED (Backend: OpenCV VideoCapture({args.camera}))")
    print("[INFO] Starting live telemetry stream. Press Ctrl+C to stop.\n")

    last_transmit_time = 0.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("[WARN] Failed to grab frame from camera device.")
                time.sleep(1.0)
                continue

            is_occupied, confidence, boxes = detect_occupancy_in_frame(
                frame, hog, face_cascade, threshold=args.threshold
            )

            current_time = time.time()
            if (current_time - last_transmit_time) >= args.interval:
                send_telemetry(
                    api_endpoint=args.api_url,
                    device_id=args.device_id,
                    device_secret=args.secret,
                    is_occupied=is_occupied,
                    confidence=confidence
                )
                last_transmit_time = current_time

            # Optional local preview window for laptop testing
            if args.preview:
                preview_frame = cv2.resize(frame, (640, 480))
                # Draw bounding boxes
                for (bx, by, bw, bh, label) in boxes:
                    color = (0, 0, 255) if is_occupied else (0, 255, 0)
                    cv2.rectangle(preview_frame, (bx, by), (bx + bw, by + bh), color, 2)
                    cv2.putText(preview_frame, f"{label}", (bx, by - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

                # Overlay status header
                status_text = f"Status: {'OCCUPIED' if is_occupied else 'VACANT'} ({confidence:.2f})"
                header_color = (0, 0, 255) if is_occupied else (0, 200, 0)
                cv2.putText(preview_frame, status_text, (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, header_color, 2)
                cv2.putText(preview_frame, f"Device: {args.device_id}", (20, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)

                cv2.imshow("LibraSense Laptop Camera Test - Preview", preview_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("\n[INFO] 'q' pressed in preview window. Stopping detector.")
                    break

            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\n[INFO] KeyboardInterrupt received. Stopping detector cleanly.")
    finally:
        if cap.isOpened():
            cap.release()
        if args.preview:
            cv2.destroyAllWindows()
        print("[INFO] Camera stream released. Goodbye.")


if __name__ == "__main__":
    main()
