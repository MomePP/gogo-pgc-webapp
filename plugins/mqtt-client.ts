import mqtt from "mqtt";

export default defineNuxtPlugin(() => {
    const brokerUrl = "ws://iot-broker.gogoboard.org:8083/mqtt";
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
