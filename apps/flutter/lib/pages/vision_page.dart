import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:ultralytics_yolo/ultralytics_yolo.dart';

class VisionPage extends StatefulWidget {
  const VisionPage({super.key});
  @override
  State<VisionPage> createState() => _VisionPageState();
}

class _VisionPageState extends State<VisionPage> {
  static const _modelPath = 'assets/models/yolo11n_int8.tflite';
  bool _active = false;
  bool _modelOk = true;

  @override
  void initState() {
    super.initState();
    _checkModel();
  }

  Future<void> _checkModel() async {
    try {
      await rootBundle.load(_modelPath);
    } catch (_) {
      if (mounted) setState(() => _modelOk = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('视觉检测')),
    body: Column(children: [
      Expanded(
        flex: 3,
        child: !_modelOk
          ? Container(color: Colors.grey.shade100, alignment: Alignment.center, child: const Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.error_outline, size: 48, color: Colors.red),
              SizedBox(height: 8),
              Text('模型文件缺失\n请放入 assets/models/yolo11n_int8.tflite', textAlign: TextAlign.center, style: TextStyle(color: Colors.red, fontSize: 13)),
            ]))
          : _active
            ? const YOLOView(modelPath: _modelPath, task: YOLOTask.detect)
            : Container(color: Colors.grey.shade900, alignment: Alignment.center, child: const Icon(Icons.videocam_off, size: 48, color: Colors.white38)),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: FilledButton.icon(
          onPressed: !_modelOk ? null : () => setState(() => _active = !_active),
          icon: Icon(_active ? Icons.stop : Icons.play_arrow),
          label: Text(_active ? '停止' : '开始检测'),
        ),
      ),
    ]),
  );
}
