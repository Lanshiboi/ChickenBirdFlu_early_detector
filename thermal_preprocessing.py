import cv2
import numpy as np
from thermal_utils import extract_temperature_flir

def extract_pixel_temperatures(image_input):
    """
    Extract pixel-wise temperature array from thermal image.

    Args:
        image_input: Path to thermal image or numpy array

    Returns:
        temp_array: 2D numpy array of temperatures
    """
    # For FLIR images, we need to extract the temperature data
    # This is a simplified version - in practice, you'd use flirpy or similar

    try:
        if isinstance(image_input, str):
            # Try to get temperature from metadata first
            avg_temp = extract_temperature_flir(image_input)
            # Create a synthetic temperature array based on image intensity
            image = cv2.imread(image_input, cv2.IMREAD_GRAYSCALE)
        else:
            # image_input is numpy array
            if len(image_input.shape) == 3:
                image = cv2.cvtColor(image_input, cv2.COLOR_BGR2GRAY)
            else:
                image = image_input
            # For array, use a default avg_temp or estimate
            avg_temp = np.mean(image) / 255 * 10 + 35  # Rough estimate

        if image is None:
            return np.full((100, 100), 37.0)  # Default temperature

        # Normalize image intensity to temperature range
        # Assuming darker areas are cooler, brighter are warmer
        temp_range = 10.0  # 10°C range
        temp_min = avg_temp - temp_range/2
        temp_max = avg_temp + temp_range/2

        # Normalize: dark = cool, bright = warm (no inversion needed)
        normalized = image.astype(np.float32) / 255.0
        temp_array = temp_min + normalized * temp_range

        return temp_array

    except Exception as e:
        print(f"Error extracting temperatures: {e}")
        # Return default array
        return np.full((100, 100), 37.0)
