Model files needed:

1. MoveNet Lightning (Pose Estimation)
   Download: https://www.kaggle.com/models/google/movenet/tfLite/lightning-int8
   File: movenet_lightning.tflite (rename from the downloaded .tflite)
   Used by: fixed_device_page.dart via pose_estimator.dart

2. YOLOv11n INT8 (Object Detection) - already present
   Download: https://docs.ultralytics.com/integrations/tflite/
   File: yolo11n_int8.tflite
   Used by: vision_page.dart via ultralytics_yolo plugin
