import 'package:flutter/material.dart';
import '../services/vision/vision_mode.dart';

class VisionLogPanel extends StatelessWidget {
  final List<VisionLogEntry> entries;
  final String statusText;
  final VoidCallback onClear;

  const VisionLogPanel({
    super.key,
    required this.entries,
    required this.statusText,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF0C0C1C),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          color: const Color(0xFF141428),
          child: Row(children: [
            Expanded(
              child: Text(
                statusText,
                style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: Color(0xFF00E676)),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: onClear,
              child: Text('clear', style: TextStyle(fontSize: 10, color: Colors.white.withValues(alpha: 0.25))),
            ),
          ]),
        ),
        Expanded(
          child: entries.isEmpty
            ? const Center(child: Text('\u2014', style: TextStyle(color: Colors.white12, fontSize: 24)))
            : ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                itemCount: entries.length,
                itemBuilder: (_, i) {
                  final entry = entries[i];
                  final color = entry.isAlert ? Colors.redAccent : Colors.cyan.shade300;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 1),
                    child: Text(
                      '[${entry.formattedTime}] ${entry.message}',
                      style: TextStyle(fontSize: 10, fontFamily: 'monospace', color: color),
                    ),
                  );
                },
              ),
        ),
      ]),
    );
  }
}
