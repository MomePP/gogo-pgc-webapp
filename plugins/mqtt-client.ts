import mqtt from "mqtt";

export default defineNuxtPlugin(() => {
    const brokerUrl = "wss://iot-broker.gogoboard.org:8084/mqtt";
    const client = mqtt.connect(brokerUrl, {
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
    });

    client.on("connect", () => {
        console.log("✅ Connected to MQTT broker");
        client.subscribe("gogo-pgc/+/command");
    });

    client.on("error", (err) => {
        console.error("❌ MQTT Connection Error:", err);
    });

    return {
        provide: {
            mqtt: client,
        },
    };
});
