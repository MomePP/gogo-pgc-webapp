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
        client.subscribe("blockly/response");
    });

    client.on("error", (err) => {
    console.error("❌ MQTT Connection Error:", err);
  });


    client.on("message", (topic, message) => {
        console.log(`📩 Received: ${message.toString()} on topic: ${topic}`);
    });

    return {
        provide: {
            mqtt: client,
        },
    };
});
