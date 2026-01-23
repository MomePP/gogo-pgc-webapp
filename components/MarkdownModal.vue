<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
    show: boolean
    title: string
    markdownUrl: string
}>()

const emit = defineEmits<{
    close: []
}>()

const markdownContent = ref('')
const isLoading = ref(false)
const error = ref('')

// Fetch and render markdown
const fetchMarkdown = async () => {
    if (!props.markdownUrl) return

    isLoading.value = true
    error.value = ''

    try {
        const response = await fetch(props.markdownUrl)
        if (!response.ok) throw new Error('Failed to load content')
        const text = await response.text()
        markdownContent.value = parseMarkdown(text)
    } catch (err) {
        error.value = 'Failed to load content'
        console.error(err)
    } finally {
        isLoading.value = false
    }
}

// Simple markdown parser
const parseMarkdown = (md: string): string => {
    let html = md

    // Escape HTML
    html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // Code blocks (```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>')
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>')
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>')

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>')

    // Tables
    html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
        const cells = content.split('|').map((c: string) => c.trim())
        const isHeader = cells.some((c: string) => /^-+$/.test(c))
        if (isHeader) return ''
        const tag = 'td'
        return '<tr>' + cells.map((c: string) => `<${tag}>${c}</${tag}>`).join('') + '</tr>'
    })

    // Wrap consecutive table rows
    html = html.replace(/(<tr>.*?<\/tr>\n?)+/g, '<table class="md-table">$&</table>')

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="md-link">$1</a>')

    // Lists (unordered)
    html = html.replace(/^- (.*$)/gm, '<li>$1</li>')
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="md-list">$&</ul>')

    // Numbered lists
    html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>')

    // Paragraphs (wrap remaining text blocks)
    html = html.replace(/^(?!<[hpuolta]|<hr|<pre|<code)(.+)$/gm, '<p>$1</p>')

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '')

    return html
}

// Handle escape key
const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.show) {
        emit('close')
    }
}

// Open in new tab (fullscreen) - uses the page route for rendered content
const openFullscreen = () => {
    // Convert /docs/robot-car-guide.md to /guide/robot-car-guide.md (page route)
    // The [...slug].vue page will fetch the markdown from /docs/ and render it
    const pageUrl = props.markdownUrl.replace(/^\/docs\//, '/guide/')
    window.open(pageUrl, '_blank')
}

watch(() => props.show, (show) => {
    if (show) {
        fetchMarkdown()
    }
})

onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
    <Teleport to="body">
        <transition name="modal">
            <div v-if="show" class="modal-overlay" @click.self="emit('close')">
                <div class="modal-container">
                    <!-- Header -->
                    <div class="modal-header">
                        <h2 class="modal-title">{{ title }}</h2>
                        <div class="modal-actions">
                            <!-- Fullscreen button -->
                            <button @click="openFullscreen" class="modal-btn" title="Open in new tab">
                                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                                </svg>
                            </button>
                            <!-- Close button -->
                            <button @click="emit('close')" class="modal-btn" title="Close">
                                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="modal-content">
                        <div v-if="isLoading" class="loading-state">
                            <svg class="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Loading...</span>
                        </div>
                        <div v-else-if="error" class="error-state">
                            {{ error }}
                        </div>
                        <div v-else class="markdown-body" v-html="markdownContent"></div>
                    </div>
                </div>
            </div>
        </transition>
    </Teleport>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 2rem;
}

.modal-container {
    background: white;
    border-radius: 1rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 800px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
}

.modal-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
}

.modal-actions {
    display: flex;
    gap: 0.5rem;
}

.modal-btn {
    padding: 0.5rem;
    border-radius: 0.5rem;
    color: #6b7280;
    transition: all 0.15s;
    background: transparent;
    border: none;
    cursor: pointer;
}

.modal-btn:hover {
    background: #e5e7eb;
    color: #1f2937;
}

.modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
}

.loading-state,
.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem;
    color: #6b7280;
}

.error-state {
    color: #ef4444;
}

/* Markdown Styles */
.markdown-body {
    color: #374151;
    line-height: 1.7;
}

.markdown-body :deep(h1) {
    font-size: 1.75rem;
    font-weight: 800;
    color: #111827;
    margin: 0 0 1rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #e5e7eb;
}

.markdown-body :deep(h2) {
    font-size: 1.35rem;
    font-weight: 700;
    color: #1f2937;
    margin: 1.5rem 0 0.75rem 0;
}

.markdown-body :deep(h3) {
    font-size: 1.1rem;
    font-weight: 600;
    color: #374151;
    margin: 1.25rem 0 0.5rem 0;
}

.markdown-body :deep(p) {
    margin: 0.75rem 0;
}

.markdown-body :deep(hr) {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 1.5rem 0;
}

.markdown-body :deep(.code-block) {
    background: #1f2937;
    color: #e5e7eb;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    font-size: 0.875rem;
    margin: 1rem 0;
}

.markdown-body :deep(.code-block code) {
    background: none;
    padding: 0;
    color: inherit;
}

.markdown-body :deep(.inline-code) {
    background: #f3f4f6;
    color: #e11d48;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.875em;
}

.markdown-body :deep(.md-table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: 0.875rem;
}

.markdown-body :deep(.md-table td) {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e5e7eb;
}

.markdown-body :deep(.md-table tr:first-child td) {
    background: #f9fafb;
    font-weight: 600;
}

.markdown-body :deep(.md-link) {
    color: #4f46e5;
    text-decoration: none;
}

.markdown-body :deep(.md-link:hover) {
    text-decoration: underline;
}

.markdown-body :deep(.md-list) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
}

.markdown-body :deep(.md-list li) {
    margin: 0.25rem 0;
}

.markdown-body :deep(strong) {
    font-weight: 600;
    color: #1f2937;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
    transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
    transform: scale(0.95) translateY(10px);
}
</style>
