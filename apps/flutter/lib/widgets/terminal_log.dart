import 'package:flutter/material.dart';

class TerminalLog extends StatelessWidget {
  final List<String> entries;
  final VoidCallback onClear;
  final double maxHeight;

  const TerminalLog({
    super.key,
    required this.entries,
    required this.onClear,
    this.maxHeight = 180,
  });

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) return const SizedBox.shrink();
    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      color: const Color(0xFF0F0F23),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          child: Row(children: [
            const Icon(Icons.terminal, size: 12, color: Colors.white38),
            const SizedBox(width: 6),
            Text('事件日志', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.4))),
            const Spacer(),
            GestureDetector(
              onTap: onClear,
              child: Text('清空', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.25))),
            ),
          ]),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
            itemCount: entries.length,
            itemBuilder: (_, i) {
              final line = entries[i];
              final color = line.startsWith('[ERR]') || line.startsWith('[FALL]') ? Colors.redAccent
                  : line.startsWith('[WARN]') ? Colors.orangeAccent
                  : Colors.green.shade300;
              return Text(line, style: TextStyle(fontSize: 10, fontFamily: 'monospace', color: color));
            },
          ),
        ),
      ]),
    );
  }
}
