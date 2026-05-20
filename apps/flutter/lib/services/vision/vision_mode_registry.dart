import 'vision_mode.dart';

class VisionModeRegistry {
  static final List<VisionMode> _modes = [];

  static void register(VisionMode mode) {
    _modes.add(mode);
  }

  static List<VisionMode> get modes => List.unmodifiable(_modes);

  static VisionMode? byId(String id) {
    try {
      return _modes.firstWhere((m) => m.id == id);
    } catch (_) {
      return null;
    }
  }
}
