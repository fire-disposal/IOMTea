import net from 'node:net'
import { decode } from '@msgpack/msgpack'
import type { DbClient } from '../../core/db'
import { MattressModule } from '../mqtt/mattress'

interface GatewayMessage {
  sn: string
  hb?: number
  br?: number
  od?: number
  p?: string
  st: string
  we?: number
  wt?: string
  fv?: number
  time: string
}

function timeStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

// ─── MessagePack decoder ───

function decodeMsgpack(payload: Uint8Array): GatewayMessage | null {
  try {
    const entry: any = decode(payload) as any
    const msg: GatewayMessage = { sn: '', st: 'off', time: timeStr() }

    msg.sn = entry.sn || ''
    const d = entry.d
    if (d) {
      msg.st = d.st || 'off'
      msg.hb = d.hb
      msg.br = d.br
      msg.od = d.od === 255 ? -1 : d.od
      msg.we = d.we === 255 ? -1 : d.we
      msg.wt = d.wt === true ? '1' : d.wt === false ? '0' : undefined
      msg.fv = d.fv
      if (Array.isArray(d.p) && d.p.length >= 2) {
        msg.p = `[${d.p[0]},${d.p[1]}]`
      }
    }
    return msg
  } catch {
    return null
  }
}

// ─── TLV fallback decoder ───

function decodeTLV(payload: Buffer): GatewayMessage | null {
  const msg: GatewayMessage = { sn: '', st: 'off', time: timeStr() }
  let idx = 0

  while (idx < payload.length) {
    const b = payload[idx]
    idx++

    if (b === 0x92) {
      if (idx + 1 >= payload.length) break
      msg.p = `[${payload[idx]},${payload[idx + 1]}]`
      idx += 2
      continue
    }

    if (b >= 0xA1 && b <= 0xA7) {
      const len = b - 0xA0
      if (idx + len > payload.length) break
      const key = payload.toString('utf8', idx, idx + len)
      idx += len

      if (idx >= payload.length) break
      const v = payload[idx]
      idx++

      switch (key) {
        case 'hb': msg.hb = v === 255 ? -1 : v; break
        case 'br': msg.br = v === 255 ? -1 : v; break
        case 'od': msg.od = v === 255 ? -1 : v; break
        case 'st': msg.st = String.fromCharCode(v); break
        case 'we': msg.we = v === 255 ? -1 : v; break
        case 'wt': msg.wt = v === 0xC3 ? '1' : '0'; break
        case 'fv': msg.fv = v; break
        case 'sn': {
          const snBytes = [v]
          while (idx < payload.length) {
            const nb = payload[idx]
            if (nb >= 0xA1 && nb <= 0xA7) break
            snBytes.push(nb)
            idx++
          }
          msg.sn = Buffer.from(snBytes).toString('utf8')
          break
        }
      }
    }
  }

  return msg.sn ? msg : null
}

// ─── Frame decoder ───

function tryDecode(buf: Buffer): { consumed: number; msg: GatewayMessage | null } | null {
  if (buf.length < 4) return null

  // MsgPack: magic 0xAB 0xCD
  if (buf[0] === 0xAB && buf[1] === 0xCD) {
    const len = buf[2]
    const total = 4 + len
    if (buf.length < total) return null
    const payload = buf.subarray(4, total)
    const msg = decodeMsgpack(new Uint8Array(payload))
    return { consumed: total, msg }
  }

  // TLV fallback: payload starts at byte 8
  const len = buf[2]
  const total = 4 + len
  if (buf.length < total) return null
  const payload = buf.subarray(8, total)
  const msg = decodeTLV(payload)
  return { consumed: total, msg }
}

// ─── TCP server ───

export interface TcpIngestConfig {
  port: number
}

export function startTcpIngest(db: DbClient, config: TcpIngestConfig): void {
  const mattress = new MattressModule()

  const server = net.createServer((socket) => {
    console.log(`[ingest:tcp] device connected from ${socket.remoteAddress}`)
    let buf = Buffer.alloc(0)

    socket.on('data', async (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk])

      let result
      while ((result = tryDecode(buf)) !== null) {
        buf = buf.subarray(result.consumed)
        if (result.msg) {
          try {
            await mattress.process(db, result.msg)
          } catch (err) {
            console.error('[ingest:tcp] mattress process error:', err)
          }
        }
      }
    })

    socket.on('error', (err) => {
      console.error('[ingest:tcp] socket error:', err)
    })

    socket.on('close', () => {
      console.log('[ingest:tcp] device disconnected')
    })
  })

  server.listen(config.port, () => {
    console.log(`[ingest:tcp] listening on port ${config.port}`)
  })

  server.on('error', (err) => {
    console.error('[ingest:tcp] server error:', err)
  })
}
