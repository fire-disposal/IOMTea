/**
 * IOMTea 启动横幅
 *
 * 多行字符画，在服务启动时打印。
 * 生成工具: figlet / patorjk.com ASCII 字体 "Big"
 */

const mode = process.env.NODE_ENV || 'development'

export const BANNER = `
  ┌──────────────────────────────────────────────────────┐
  │   ██╗ ██████╗ ███╗   ███╗████████╗███████╗ █████╗    │
  │   ██║██╔═══██╗████╗ ████║╚══██╔══╝██╔════╝██╔══██╗   │
  │   ██║██║   ██║██╔████╔██║   ██║   █████╗  ███████║   │
  │   ██║██║   ██║██║╚██╔╝██║   ██║   ██╔══╝  ██╔══██║   │
  │   ██║╚██████╔╝██║ ╚═╝ ██║   ██║   ███████╗██║  ██║   │
  │   ╚═╝ ╚═════╝ ╚═╝     ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝   │
  │   ⋯ Internet of Medical Things Architecture ⋯        │
  └──────────────────────────────────────────────────────┘
`

export function printBanner(logger: { info: (msg: string) => void }) {
  for (const line of BANNER.split('\n')) {
    if (line.trim()) logger.info(line)
  }
}
