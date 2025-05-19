import { ref } from 'vue'

const channel = ref<string>('')

export function useChannel() {
  return {
    channel,
  }
}
