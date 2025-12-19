// https://nuxt.com/docs/api/configuration/nuxt-config

import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  css: ["@/assets/css/tailwind.css"],
  ssr: false,
  app: {
    baseURL: '/gogo-pgc-webapp',
  },
  nitro: {
    preset: 'static'
  },
  vite: {
    plugins: [tailwindcss()]
  },
  vue: {
    compilerOptions: {
      isCustomElement: (tag: string) => [
        'xml',
        'category',
        'block',
        'value',
        'field',
        'shadow',
        'mutation',
        'sep',
      ].includes(tag),
    }
  },
  runtimeConfig: {
    public: {
      mqttBrokerUrl: process.env.MQTT_BROKER_URL || "",
      broadcastTopic: process.env.BROADCAST_TOPIC || "",
      broadcastPassword: process.env.BROADCAST_PASSWORD || "",
      mqttRemoteTopic: process.env.MQTT_REMOTE_TOPIC || "",
      mqttBlocklyTopic: process.env.MQTT_BLOCKLY_TOPIC || "",
      mqttControlTopic: process.env.MQTT_CONTROL_TOPIC || "",
    }
  },
  plugins: [
    '~/plugins/mqtt-client',
    '~/plugins/webhid-plugin',
  ],
  // build: {
  //   transpile: [
  //     'blockly/core', // or just 'blockly' if you're using the full library
  //     'blockly/blocks',
  //     'blockly/javascript', // and any other blockly parts you're using
  //     'blockly/msg/en' // or your locale
  //   ]
  // }
})
