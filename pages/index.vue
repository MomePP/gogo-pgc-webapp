<script setup>
import SettingsPanel from "~/components/SettingsPanel.vue";
import BlocklyEditor from "~/components/BlocklyEditor.vue";
import { isSidebarCollapsed, toggleSidebar } from '~/composables/useLayoutState';
</script>

<template>
  <div class="flex h-screen relative overflow-hidden">
    <!-- Global Stacking Notifications -->
    <transition-group name="toast" tag="div"
      class="fixed top-6 right-6 z-[100] flex flex-col items-end gap-3 pointer-events-none">
      <div v-for="noti in notifications" :key="noti.id"
        class="pointer-events-auto px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border transition-all duration-300"
        :class="[
          noti.type === 'error' ? 'bg-red-100 border-red-300 text-red-700' :
            noti.type === 'success' ? 'bg-green-100 border-green-300 text-green-700' :
              'bg-blue-100 border-blue-300 text-blue-700'
        ]">
        <!-- Type Specific Icon -->
        <svg v-if="noti.type === 'success'" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
          viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else-if="noti.type === 'error'" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
          viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <svg v-else class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>

        <span class="text-xs font-bold uppercase tracking-wider">{{ noti.message }}</span>
      </div>
    </transition-group>

    <!-- Left Sidebar (Settings Panel) -->
    <div :class="[
      'flex flex-col bg-gray-900 text-gray-100 transition-all duration-300 ease-in-out relative overflow-hidden',
      isSidebarCollapsed ? 'w-12' : 'min-w-[340px] w-1/5'
    ]">
      <button v-if="isSidebarCollapsed" @click="toggleSidebar"
        class="absolute top-6 left-1/2 -translate-x-1/2 hover:bg-gray-800 text-gray-400 rounded-full p-2 transition-colors"
        title="Expand Settings">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
          class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      <!-- Only render content when expanded -->
      <transition name="fade" mode="out-in">
        <div v-show="!isSidebarCollapsed" key="panel" class="h-full">
          <SettingsPanel />
        </div>
      </transition>
    </div>

    <!-- Right Panel (Blockly) -->
    <div class="flex-1">
      <BlocklyEditor />
    </div>
  </div>
</template>

<style scoped>
/* Toast Animation - Slide and Stacking */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(50px);
}

.toast-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* Ensure smooth movement when items above are removed */
.toast-move {
  transition: transform 0.4s ease;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
