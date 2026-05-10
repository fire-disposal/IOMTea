use clap::Parser;

#[derive(Parser, Debug, Clone)]
#[command(name = "iomtea-gateway")]
pub struct Config {
    /// TCP listen address
    #[arg(long, env = "TCP_BIND", default_value = "0.0.0.0:5858")]
    pub tcp_bind: String,

    /// MQTT broker address
    #[arg(long, env = "MQTT_BROKER", default_value = "mqtt://localhost:1883")]
    pub mqtt_broker: String,

    /// MQTT client ID prefix
    #[arg(long, env = "MQTT_CLIENT_ID", default_value = "iomtea-gateway")]
    pub mqtt_client_id: String,

    /// MQTT username (optional)
    #[arg(long, env = "MQTT_USERNAME")]
    pub mqtt_username: Option<String>,

    /// MQTT password (optional)
    #[arg(long, env = "MQTT_PASSWORD")]
    pub mqtt_password: Option<String>,
}
