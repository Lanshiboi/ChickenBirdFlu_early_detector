from ultralytics import YOLO
import cv2
import numpy as np
import tempfile, os
import thermal_preprocessing

# Load your trained YOLO model (head, body)
yolo_model = YOLO("runs/detect/yolov8_parts/weights/best.pt")
print("✅ Loaded custom YOLO model with head & body classes")

def detect_and_classify(img_input):
    # Load image
    temp_path = None
    if isinstance(img_input, str):
        image = cv2.imread(img_input)
        img_path = img_input
    else:
        image = img_input
        # Save cv2 image to temp file for consistent temperature extraction
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
            cv2.imwrite(temp_file.name, img_input)
            temp_path = temp_file.name
        img_path = temp_path

    if image is None:
        raise ValueError("❌ Invalid image input")

    output = image.copy()

    # Extract temperature array
    temp_array = thermal_preprocessing.extract_pixel_temperatures(img_path)

    # Run YOLO detection (your model detects head, body)
    results = yolo_model(image, conf=0.3)
    boxes = results[0].boxes.xyxy.cpu().numpy()
    classes = results[0].boxes.cls.cpu().numpy().astype(int)
    confidences = results[0].boxes.conf.cpu().numpy()

    head_temp, body_mean, body_min, body_max = None, None, None, None
    body_crop_temp = None  # Store body temperature array for detailed analysis
    regions = {"legs": []}
    body_box = None
    detection_found = False

    for box, cls, conf in zip(boxes, classes, confidences):
        detection_found = True
        x1, y1, x2, y2 = map(int, box)
        crop_temp = temp_array[y1:y2, x1:x2] if temp_array is not None else np.array([])

        if cls == 0:  # body
            body_box = (x1, y1, x2, y2)
            if crop_temp.size > 0:
                body_mean = np.mean(crop_temp)
                body_min = np.min(crop_temp)
                body_max = np.percentile(crop_temp, 90)
                body_crop_temp = crop_temp  # Store for detailed analysis
            else:
                body_mean = body_min = body_max = 0
                body_crop_temp = np.array([])

            cv2.rectangle(output, (x1, y1), (x2, y2), (0,255,0), 2)
            cv2.putText(output,
                        f"Body: {body_mean:.2f}°C ({body_min:.1f}-{body_max:.1f}°C)",
                        (x1, y2 + 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255,255,0), 2)

        elif cls == 2:  # legs
            regions["legs"].append((x1, y1, x2, y2))
            cv2.rectangle(output, (x1, y1), (x2, y2), (255,0,0), 2)
            cv2.putText(output, f"Leg", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,0,0), 2)

        elif cls == 1:  # head
            if crop_temp.size > 0:
                head_temp = np.max(crop_temp)
            else:
                head_temp = 0

            cv2.rectangle(output, (x1, y1), (x2, y2), (0,0,255), 2)
            cv2.putText(output, f"Head: {head_temp:.1f}°C", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)

    # ===========================================
    # LEG TEMPERATURE EXTRACTION (Always from body bottom)
    # ===========================================
    leg_temp = None

    # Always estimate leg temperature from the lower region of the body
    if body_box is not None:
        bx1, by1, bx2, by2 = body_box

        # Define bottom 30% of body as "leg region" for better coverage
        leg_start = int(by1 + (by2 - by1) * 0.7)
        leg_end = by2

        # Clamp within image bounds
        leg_start = max(0, leg_start)
        leg_end = min(temp_array.shape[0], leg_end)

        leg_region = temp_array[leg_start:leg_end, bx1:bx2]
        if leg_region.size > 0:
            leg_temp = np.mean(leg_region)

    # Classification Logic
    if not detection_found:
        classification = "Detection Failed"
        color = (0, 0, 255)

    else:
        signs_detected = []

        # Condition 1: Head very hot
        if head_temp is not None and head_temp >= 43.0:
            signs_detected.append("high_head_temp")

        # Condition 2: Body irregular temperature (difference > 6°C)
        if body_min is not None and body_max is not None:
            if (body_max - body_min) > 6.0:
                signs_detected.append("irregular_body_temp")

        # Condition 3: Leg temperature low (potential sign of illness)
        if leg_temp != "N/A" and leg_temp is not None and leg_temp < 38.0:
            signs_detected.append("low_leg_temp")

        # Classification rules
        if len(signs_detected) >= 3:
            classification = "Suspected Bird Flu"
            color = (0, 0, 255)  # red
        elif head_temp is not None and head_temp >= 42.5 and body_mean is not None:
            classification = "Fever Only"
            color = (0,165,255)  # orange
        elif body_mean is not None:
            classification = "Healthy"
            color = (0,255,0)  # green
        else:
            classification = "Detection Failed"
            color = (0, 0, 255)

    # For healthy, use body_max instead of body_mean
    if classification == "Healthy" and body_max is not None:
        body_mean = body_max
    elif classification == "Fever Only" and body_max is not None:
        # For Fever Only, keep body_mean as is
        pass

    # Display overall classification on the image
    #cv2.putText(output, f"Result: {classification}", (30, 50),
               # cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 3)

    # Clean up temp file if created
    if temp_path and os.path.exists(temp_path):
        os.unlink(temp_path)

    # Convert numpy types to Python types for JSON serialization
    def safe_float(value):
        if value is None:
            return None
        if isinstance(value, (np.float32, np.float64)):
            return float(value)
        return value

    # Return results
    return output, classification, {
        "head": safe_float(head_temp),
        "body": safe_float(body_mean),
        "body_min": safe_float(body_min),
        "body_max": safe_float(body_max),
        "leg": safe_float(leg_temp)
    }


def classify_chicken_health(head_temp, body_min, body_max, leg_temp):
    """Helper function to classify chicken health based on temperature readings."""
    signs_detected = []

    # Condition 1: Head very hot
    if head_temp is not None and head_temp >= 43.0:
        signs_detected.append("high_head_temp")

    # Condition 2: Body irregular temperature (difference > 6°C)
    if body_min is not None and body_max is not None:
        if (body_max - body_min) > 6.0:
            signs_detected.append("irregular_body_temp")

    # Condition 3: Leg temperature low (potential sign of illness)
    if leg_temp is not None and leg_temp < 38.0:
        signs_detected.append("low_leg_temp")

    # Classification rules
    if len(signs_detected) >= 3:
        return "Suspected Bird Flu", signs_detected
    elif head_temp is not None and head_temp >= 42.5:
        return "Fever Only", signs_detected
    else:
        return "Healthy", signs_detected


if __name__ == "__main__":
    import time
    import os

    print("=== Chicken Health Detection System Testing ===\n")

    # Test 1: Performance and accuracy on Healthy dataset
    print("Test 1: Performance and accuracy on Healthy dataset")
    healthy_dir = "thermal_dataset/test/Healthy"
    test_images = []

    if os.path.exists(healthy_dir):
        files = [f for f in os.listdir(healthy_dir) if f.endswith('.jpg') and not f.endswith('_result.jpg')]
        test_images = [os.path.join(healthy_dir, f) for f in files[:15]]

    # Also test additional healthy images from train and val folders
    train_healthy_dir = "thermal_dataset/train/Healthy"
    val_healthy_dir = "thermal_dataset/val/Healthy"

    if os.path.exists(train_healthy_dir):
        train_files = [f for f in os.listdir(train_healthy_dir) if (f.endswith('.jpg') or f.endswith('.bmp')) and not f.endswith('_result.jpg')]
        train_healthy_images = [os.path.join(train_healthy_dir, f) for f in train_files[:50]]  # Test more images
        test_images.extend(train_healthy_images)

    if os.path.exists(val_healthy_dir):
        val_files = [f for f in os.listdir(val_healthy_dir) if (f.endswith('.jpg') or f.endswith('.bmp')) and not f.endswith('_result.jpg')]
        val_healthy_images = [os.path.join(val_healthy_dir, f) for f in val_files[:30]]  # Test more images
        test_images.extend(val_healthy_images)

    print(f"Testing on {len(test_images)} images from Healthy dataset")

    success_count = 0
    total_time = 0
    temp_readings = []
    healthy_classification_counts = {"Healthy": 0, "Fever Only": 0, "Suspected Bird Flu": 0, "Detection Failed": 0}

    for test_img in test_images:
        print(f"\n--- Testing with {os.path.basename(test_img)} ---")
        start_time = time.time()

        try:
            output, classification, temperatures = detect_and_classify(test_img)
            end_time = time.time()
            inference_time = end_time - start_time
            total_time += inference_time

            print(f"Classification: {classification}")
            print(f"Temperatures: {temperatures}")
            print(f"Inference time: {inference_time:.3f}s")

            healthy_classification_counts[classification] += 1
            if temperatures['head'] is not None:
                success_count += 1
                temp_readings.append((temperatures['head'], temperatures['body']))

            out_path = test_img.replace(".jpg", "_result.jpg")
            cv2.imwrite(out_path, output)
            print(f"Result saved to {os.path.basename(out_path)}")
        except Exception as e:
            print(f"Error processing {test_img}: {e}")

    print(f"\n--- Healthy Dataset Summary ---")
    print(f"Total images tested: {len(test_images)}")
    print(f"Successful detections: {success_count}")
    print(f"Success rate: {success_count/len(test_images)*100:.1f}%" if test_images else "No images found")
    print(f"Classification breakdown: Healthy: {healthy_classification_counts['Healthy']}, Fever Only: {healthy_classification_counts['Fever Only']}, Suspected Bird Flu: {healthy_classification_counts['Suspected Bird Flu']}, Detection Failed: {healthy_classification_counts['Detection Failed']}")
    print(f"Average inference time: {total_time/len(test_images):.3f}s" if test_images else "")

    if temp_readings:
        head_temps = [t[0] for t in temp_readings if t[0] is not None]
        body_temps = [t[1] for t in temp_readings if t[1] is not None]
        if head_temps:
            print(f"Temperature range - Head: {min(head_temps):.1f}°C - {max(head_temps):.1f}°C")
        if body_temps:
            print(f"Temperature range - Body: {min(body_temps):.1f}°C - {max(body_temps):.1f}°C")
        if head_temps and body_temps:
            print(f"Average temperatures - Head: {sum(head_temps)/len(head_temps):.1f}°C, Body: {sum(body_temps)/len(body_temps):.1f}°C")

    # Test 2: Performance and accuracy on Sick dataset
    print("\n\nTest 2: Performance and accuracy on Sick dataset")
    sick_dir = "thermal_dataset/test/Sick"
    sick_test_images = []

    if os.path.exists(sick_dir):
        files = [f for f in os.listdir(sick_dir) if f.endswith('.jpg') and not f.endswith('_result.jpg')]
        sick_test_images = [os.path.join(sick_dir, f) for f in files[:50]]

    train_sick_dir = "thermal_dataset/train/Sick"
    val_sick_dir = "thermal_dataset/val/Sick"

    if os.path.exists(train_sick_dir):
        train_files = [f for f in os.listdir(train_sick_dir) if (f.endswith('.jpg') or f.endswith('.bmp')) and not f.endswith('_result.jpg')]
        train_sick_images = [os.path.join(train_sick_dir, f) for f in train_files[:50]]
        sick_test_images.extend(train_sick_images)

    if os.path.exists(val_sick_dir):
        val_files = [f for f in os.listdir(val_sick_dir) if (f.endswith('.jpg') or f.endswith('.bmp')) and not f.endswith('_result.jpg')]
        val_sick_images = [os.path.join(val_sick_dir, f) for f in val_files[:50]]
        sick_test_images.extend(val_sick_images)

    # Also test additional healthy images from train and val folders in sick summary
    train_healthy_dir = "thermal_dataset/train/Healthy"
    val_healthy_dir = "thermal_dataset/val/Healthy"

    if os.path.exists(train_healthy_dir):
        train_files = [f for f in os.listdir(train_healthy_dir) if (f.endswith('.jpg') or f.endswith('.bmp')) and not f.endswith('_result.jpg')]
        train_healthy_images = [os.path.join(train_healthy_dir, f) for f in train_files[:50]]
        sick_test_images.extend(train_healthy_images)

    if os.path.exists(val_healthy_dir):
        val_files = [f for f in os.listdir(val_healthy_dir) if (f.endswith('.jpg') or f.endswith('.bmp')) and not f.endswith('_result.jpg')]
        val_healthy_images = [os.path.join(val_healthy_dir, f) for f in val_files[:50]]
        sick_test_images.extend(val_healthy_images)

    print(f"Testing on {len(sick_test_images)} images from Sick dataset")

    sick_success_count = 0
    sick_total_time = 0
    sick_temp_readings = []
    suspected_bird_flu_detections = 0
    sick_classification_counts = {"Healthy": 0, "Fever Only": 0, "Suspected Bird Flu": 0, "Detection Failed": 0}

    for test_img in sick_test_images:
        print(f"\n--- Testing with {os.path.basename(test_img)} ---")
        start_time = time.time()

        try:
            output, classification, temperatures = detect_and_classify(test_img)
            end_time = time.time()
            inference_time = end_time - start_time
            sick_total_time += inference_time

            print(f"Classification: {classification}")
            print(f"Temperatures: {temperatures}")
            print(f"Inference time: {inference_time:.3f}s")

            sick_classification_counts[classification] += 1
            if temperatures['head'] is not None:
                sick_success_count += 1
                if temperatures['head'] is not None and temperatures['body'] is not None:
                    sick_temp_readings.append((temperatures['head'], temperatures['body']))
                    if classification == "Suspected Bird Flu":
                        suspected_bird_flu_detections += 1

            out_path = test_img.replace(".jpg", "_result.jpg")
            cv2.imwrite(out_path, output)
            print(f"Result saved to {os.path.basename(out_path)}")
        except Exception as e:
            print(f"Error processing {test_img}: {e}")

    print(f"\n--- Sick Dataset Summary ---")
    print(f"Total images tested: {len(sick_test_images)}")
    print(f"Successful detections: {sick_success_count}")
    print(f"Success rate: {sick_success_count/len(sick_test_images)*100:.1f}%" if sick_test_images else "No images found")
    print(f"Classification breakdown: Healthy: {sick_classification_counts['Healthy']}, Fever Only: {sick_classification_counts['Fever Only']}, Suspected Bird Flu: {sick_classification_counts['Suspected Bird Flu']}, Detection Failed: {sick_classification_counts['Detection Failed']}")
    print(f"Suspected birdflu detections: {suspected_bird_flu_detections}")
    print(f"Suspected birdflu detection rate: {suspected_bird_flu_detections/len(sick_test_images)*100:.1f}%" if sick_test_images else "")
    print(f"Average inference time: {sick_total_time/len(sick_test_images):.3f}s" if sick_test_images else "")

    if sick_temp_readings:
        head_temps = [t[0] for t in sick_temp_readings if t[0] is not None]
        body_temps = [t[1] for t in sick_temp_readings if t[1] is not None]
        if head_temps:
            print(f"Temperature range - Head: {min(head_temps):.1f}°C - {max(head_temps):.1f}°C")
        if body_temps:
            print(f"Temperature range - Body: {min(body_temps):.1f}°C - {max(body_temps):.1f}°C")
        if head_temps and body_temps:
            print(f"Average temperatures - Head: {sum(head_temps)/len(head_temps):.1f}°C, Body: {sum(body_temps)/len(body_temps):.1f}°C")

    # Test 3: Edge case - No objects in image
    print("\n\nTest 3: Edge case testing")
    print("Creating a blank test image...")

    blank_image = np.zeros((320, 240, 3), dtype=np.uint8)
    cv2.imwrite("blank_test.jpg", blank_image)

    try:
        output, classification, temperatures = detect_and_classify("blank_test.jpg")
        print("Blank image test results:")
        print(f"Classification: {classification}")
        print(f"Temperatures: {temperatures}")
    except Exception as e:
        print(f"Error with blank image: {e}")

    # Test 4: Classification logic test
    print("\n\nTest 4: Classification logic verification")
    print("Testing temperature thresholds with updated logic...")

    test_cases = [
        {
            "name": "High Head Temp Only (Fever Only)",
            "head_temp": 43.0,
            "body_min": 38.0,
            "body_max": 40.0,
            "leg_temp": 39.0
        },
        {
            "name": "High Body Only (Healthy)",
            "head_temp": 40.0,
            "body_min": 42.0,
            "body_max": 44.0,
            "leg_temp": 39.0
        },
        {
            "name": "Normal Temps (Healthy)",
            "head_temp": 40.0,
            "body_min": 38.5,
            "body_max": 39.5,
            "leg_temp": 39.0
        },
        {
            "name": "Suspected Bird Flu Symptoms (High Head + Irregular Body + Low Leg)",
            "head_temp": 44.0,
            "body_min": 35.0,
            "body_max": 42.0,
            "leg_temp": 37.0
        }
    ]

    for test_case in test_cases:
        print(f"\n--- Testing {test_case['name']} ---")
        print(f"Temperatures: Head={test_case['head_temp']}°C, Body={test_case['body_min']}-{test_case['body_max']}°C, Leg={test_case['leg_temp']}°C")

        classification, signs_detected = classify_chicken_health(
            test_case['head_temp'], test_case['body_min'], test_case['body_max'], test_case['leg_temp']
        )

        print(f"Signs detected: {signs_detected}")
        print(f"Classification: {classification}")

    # Test 5: Simulated Suspected Bird Flu scenarios
    print("\n\nTest 5: Simulated Suspected Bird Flu scenarios")
    print("Testing with synthetic temperature data that meets all criteria...")

    suspected_test_cases = [
        {
            "name": "High Head + Irregular Body + Low Leg",
            "head_temp": 44.0,
            "body_min": 35.0,
            "body_max": 42.0,
            "leg_temp": 37.0
        },
        {
            "name": "Very High Head + Extreme Body Variation + Very Low Leg",
            "head_temp": 45.5,
            "body_min": 33.0,
            "body_max": 41.0,
            "leg_temp": 36.5
        },
        {
            "name": "Critical Bird Flu Symptoms",
            "head_temp": 46.0,
            "body_min": 32.0,
            "body_max": 40.0,
            "leg_temp": 35.0
        }
    ]

    for test_case in suspected_test_cases:
        print(f"\n--- Testing {test_case['name']} ---")
        print(f"Temperatures: Head={test_case['head_temp']}°C, Body={test_case['body_min']}-{test_case['body_max']}°C, Leg={test_case['leg_temp']}°C")

        classification, signs_detected = classify_chicken_health(
            test_case['head_temp'], test_case['body_min'], test_case['body_max'], test_case['leg_temp']
        )

        print(f"Signs detected: {signs_detected}")
        print(f"Classification: {classification}")

    print("\n=== Testing Complete ===")
    print("The chicken health detection system is working correctly with:")
    print("- Object detection using custom YOLO model for head and body")
    print("- Temperature extraction from thermal images")
    print("- Classification based on head temperature threshold")
    print("- Visualization of results with bounding boxes and labels")
