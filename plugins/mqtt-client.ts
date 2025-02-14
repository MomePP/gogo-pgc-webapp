import mqtt from "mqtt";

export default defineNuxtPlugin(() => {
    const brokerUrl = "wss://iot-broker.gogoboard.org:8084/mqtt"; // Replace with your broker URL
    const client = mqtt.connect(brokerUrl, {
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
    });

    client.on("connect", () => {
        console.log("✅ Connected to MQTT broker");
        client.subscribe("gogo-pgc/blockly/command");
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
