use serde::{Deserialize, Serialize};
use rmp_serde::from_slice;

/// Output structure — pure protocol data, no business fields
#[derive(Debug, Clone, Serialize)]
pub struct GatewayMessage {
    pub sn: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hb: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub br: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub od: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub p: Option<String>,
    pub st: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub we: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fv: Option<i32>,
    pub time: String,
}

impl Default for GatewayMessage {
    fn default() -> Self {
        GatewayMessage {
            sn: String::new(),
            hb: None, br: None, od: None, p: None,
            st: "off".to_string(),
            we: None, wt: None, fv: None,
            time: String::new(),
        }
    }
}

// ─── MessagePack decoder (0xAB 0xCD header) ───

#[derive(Debug, Deserialize)]
struct BedEntry {
    #[allow(dead_code)]
    #[serde(rename = "ma")] ma: Option<String>,
    #[allow(dead_code)]
    #[serde(rename = "mo")] mo: Option<String>,
    #[allow(dead_code)]
    #[serde(rename = "v")]  v: Option<u8>,
    #[serde(rename = "sn")] sn: Option<String>,
    #[serde(rename = "d")]  d: Option<BedD>,
}

#[derive(Debug, Deserialize)]
struct BedD {
    #[serde(rename = "st")] st: Option<String>,
    #[serde(rename = "hb")] hb: Option<i32>,
    #[serde(rename = "br")] br: Option<i32>,
    #[serde(rename = "wt")] wt: Option<bool>,
    #[serde(rename = "od")] od: Option<i32>,
    #[serde(rename = "we")] we: Option<i32>,
    #[serde(rename = "p")]  p: Option<Vec<i32>>,
    #[serde(rename = "fv")] fv: Option<i32>,
}

fn decode_msgpack(payload: &[u8]) -> Option<GatewayMessage> {
    let entry: BedEntry = from_slice(payload).ok()?;
    let mut msg = GatewayMessage::default();

    msg.sn = entry.sn.unwrap_or_default();
    if let Some(d) = entry.d {
        msg.st = d.st.unwrap_or_else(|| "off".to_string());
        msg.hb = d.hb;
        msg.br = d.br;
        msg.od = d.od.map(|v| if v == 255 { -1 } else { v });
        msg.we = d.we.map(|v| if v == 255 { -1 } else { v });
        msg.wt = d.wt.map(|b| if b { "1".to_string() } else { "0".to_string() });
        msg.fv = d.fv;
        if let Some(p) = d.p {
            if p.len() >= 2 {
                msg.p = Some(format!("[{},{}]", p[0], p[1]));
            }
        }
    }
    msg.time = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    Some(msg)
}

// ─── TLV fallback decoder ───

fn decode_tlv(payload: &[u8]) -> Option<GatewayMessage> {
    let mut msg = GatewayMessage::default();
    let mut idx = 0usize;

    while idx < payload.len() {
        let b = payload[idx];
        idx += 1;

        if b == 0x92 {
            if idx + 1 >= payload.len() { break }
            let a = payload[idx] as i32;
            let c = payload[idx + 1] as i32;
            msg.p = Some(format!("[{},{}]", a, c));
            idx += 2;
            continue;
        }

        if b >= 0xA1 && b <= 0xA7 {
            let len = (b - 0xA0) as usize;
            if idx + len > payload.len() { break }

            let key_bytes = &payload[idx..idx + len];
            let key = String::from_utf8_lossy(key_bytes).to_string();
            idx += len;

            // Read next key+value or value
            // The TLV encodes: key_prefix+key_len+key_bytes, then value
            // Value is at the next position
            // Actually the original protocol interleaves: key bytes then value bytes
            // Let me follow the old server.js more closely:
            // After reading key, the NEXT byte group is the value
            // Value can be: another TLV key (if 0xA1-0xA7) or a plain byte
            if idx >= payload.len() { break }
            let v = payload[idx] as i32;
            idx += 1;

            match key.as_str() {
                "hb" => msg.hb = Some(if v == 255 { -1 } else { v }),
                "br" => msg.br = Some(if v == 255 { -1 } else { v }),
                "od" => msg.od = Some(if v == 255 { -1 } else { v }),
                "st" => msg.st = String::from_utf8_lossy(&[v as u8]).to_string(),
                "we" => msg.we = Some(if v == 255 { -1 } else { v }),
                "wt" => msg.wt = Some(if v == 195 { "1".to_string() } else { "0".to_string() }),
                "sn" => {
                    // SN is multi-byte — read remaining as string
                    let mut sn_bytes = vec![v as u8];
                    while idx < payload.len() {
                        let nb = payload[idx];
                        if nb >= 0xA1 && nb <= 0xA7 { break } // next key
                        sn_bytes.push(nb);
                        idx += 1;
                    }
                    msg.sn = String::from_utf8_lossy(&sn_bytes).to_string();
                }
                "fv" => msg.fv = Some(v),
                _ => {}
            }
        }
    }

    msg.time = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    if msg.sn.is_empty() { return None }
    Some(msg)
}

// ─── Public API ───

pub fn try_decode(buf: &[u8]) -> Option<(usize, Option<GatewayMessage>)> {
    if buf.len() < 4 { return None }

    // Msgpack mode: magic 0xAB 0xCD
    if buf[0] == 0xAB && buf[1] == 0xCD {
        let len = buf[2] as usize;
        let total = 4 + len;
        if buf.len() < total { return None }
        let payload = &buf[4..total];
        let msg = decode_msgpack(payload);
        return Some((total, msg));
    }

    // TLV fallback: payload starts at byte 8
    let len = buf[2] as usize;
    let total = 4 + len;
    if buf.len() < total { return None }
    let payload = &buf[8..total];
    let msg = decode_tlv(payload);
    Some((total, msg))
}
