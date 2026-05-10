use anyhow::Result;
use bytes::BytesMut;
use clap::Parser;
use rumqttc::{MqttOptions, Client, QoS};
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::net::{TcpListener, TcpStream};

mod config;
mod decoder;

use config::Config;

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();
    let config = Config::parse();
    log::info!("iomtea-gateway starting, tcp={}, mqtt={}", config.tcp_bind, config.mqtt_broker);

    // MQTT client
    let host = config.mqtt_broker
        .replace("mqtt://", "")
        .replace("tcp://", "")
        .trim_end_matches('/')
        .to_string();
    let mut mqtt_opts = MqttOptions::new(
        &config.mqtt_client_id,
        &host,
        1883,
    );
    if let (Some(u), Some(p)) = (&config.mqtt_username, &config.mqtt_password) {
        mqtt_opts.set_credentials(u, p);
    }
    mqtt_opts.set_keep_alive(Duration::from_secs(30));

    let (mqtt_client, mut mqtt_conn) = Client::new(mqtt_opts, 128);

    // MQTT event loop
    tokio::spawn(async move {
        loop {
            match mqtt_conn.eventloop.poll().await {
                Ok(rumqttc::Event::Incoming(rumqttc::Packet::ConnAck(_))) => {
                    log::info!("MQTT connected");
                }
                Err(e) => {
                    log::error!("MQTT error: {}", e);
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
                _ => {}
            }
        }
    });

    // TCP listener
    let listener: TcpListener = TcpListener::bind(&config.tcp_bind).await?;
    log::info!("TCP listening on {}", config.tcp_bind);

    loop {
        let (socket, _) = listener.accept().await?;
        let mqtt = mqtt_client.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_socket(socket, mqtt).await {
                log::error!("socket handler error: {}", e);
            }
        });
    }
}

async fn handle_socket(mut socket: TcpStream, mqtt: Client) -> Result<()> {
    let mut buf = BytesMut::with_capacity(4096);

    loop {
        let mut tmp = [0u8; 1024];
        let n = socket.read(&mut tmp).await?;
        if n == 0 { break }
        buf.extend_from_slice(&tmp[..n]);

        while let Some((consumed, data)) = decoder::try_decode(&buf) {
            let _ = buf.split_to(consumed);
            if let Some(msg) = data {
                let topic = format!("device/{}/data", msg.sn);
                let json = serde_json::to_vec(&msg).unwrap_or_default();
                if let Err(e) = mqtt.try_publish(topic, QoS::AtLeastOnce, false, json) {
                    log::error!("mqtt publish failed: {}", e);
                }
            }
        }
    }

    Ok(())
}
