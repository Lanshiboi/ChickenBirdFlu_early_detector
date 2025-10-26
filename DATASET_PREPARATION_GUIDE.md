# Guide to Prepare Sample Images for Part Detection Training

Since I cannot create image files directly, here are instructions to prepare and add sample images for training the chicken parts detection model.

## Step 1: Collect Sample Images
- Use existing thermal images of chickens from your dataset.
- Select clear images showing chicken heads and legs.

## Step 2: Organize Folder Structure
Create the following folders in your project directory:
```
thermal_dataset_parts/
  train/
    images/
    labels/
  val/
    images/
    labels/
```

## Step 3: Add Images
- Place your sample images (e.g., JPG or PNG) inside the `images/` folders for train and val.
- Ensure images are named uniquely (e.g., `sample_001.jpg`, `sample_002.jpg`).

## Step 4: Label Images
- Use a labeling tool like [LabelImg](https://github.com/tzutalin/labelImg) or [Makesense.ai](https://www.makesense.ai/).
- Label the parts:
  - Class 0: head
  - Class 1: legs
- Save annotations in YOLO format (`.txt` files) inside the corresponding `labels/` folders.
- Each `.txt` file should have the same name as the image but with `.txt` extension (e.g., `sample_001.txt`).

## Step 5: Verify Dataset YAML
- Ensure `thermal_dataset_parts.yaml` points to the correct folders:
```yaml
train: thermal_dataset_parts/train/images
val: thermal_dataset_parts/val/images

nc: 2
names: ['head', 'legs']
```

## Step 6: Train the Model
- Run the training script:
```bash
python train_yolo_parts.py
```

## Additional Tips
- Start with a small number of labeled images (e.g., 20-50) for initial training.
- Gradually increase dataset size for better accuracy.
- Validate annotations carefully to avoid errors.

---

If you want, I can help you with example commands or scripts to automate parts of this process.
