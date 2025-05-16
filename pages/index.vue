<script setup>
import SettingsPanel from "~/components/SettingsPanel.vue";
import BlocklyEditor from "~/components/BlocklyEditor.vue";
</script>

<template>
  <div class="flex h-screen">
    <!-- Left Sidebar (Settings Panel) -->
    <div class="w-1/5 bg-gray-900 text-white">
      <SettingsPanel />
    </div>

    <!-- Right Panel (Blockly) -->
    <div class="w-4/5">
      <BlocklyEditor />
    </div>
  </div>
</template>
