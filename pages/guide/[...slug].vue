<script setup lang="ts">
import { ref, onMounted } from 'vue'

const route = useRoute()
const markdownContent = ref('')
const isLoading = ref(true)
const error = ref('')
const title = ref('')

// Get the markdown file path from the route
const mdPath = computed(() => {
    const slug = route.params.slug
    if (Array.isArray(slug)) {
        return '/docs/' + slug.join('/')
    }
    return '/docs/' + slug
})

// Extract title from filename
const pageTitle = computed(() => {
    const path = mdPath.value
    const filename = path.split('/').pop() || ''
    return filename
        .replace('.md', '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
})

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

// Fetch and render markdown
const fetchMarkdown = async () => {
    isLoading.value = true
    error.value = ''

    try {
        const response = await fetch(mdPath.value)
        if (!response.ok) throw new Error('Failed to load content')
        const text = await response.text()

        // Extract title from first h1 if present
        const h1Match = text.match(/^# (.+)$/m)
        if (h1Match) {
            title.value = h1Match[1]
        } else {
            title.value = pageTitle.value
        }

        markdownContent.value = parseMarkdown(text)
    } catch (err) {
        error.value = 'Failed to load content'
        console.error(err)
    } finally {
        isLoading.value = false
    }
}

onMounted(() => {
    fetchMarkdown()
})

// Set page title
useHead({
    title: () => title.value || pageTitle.value
})
</script>

<template>
    <div class="min-h-screen bg-gray-50">
        <!-- Header -->
        <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div class="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <NuxtLink to="/" class="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="Back to Editor">
                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </NuxtLink>
                    <h1 class="text-lg font-bold text-gray-800">{{ title || pageTitle }}</h1>
                </div>
                <div class="text-xs text-gray-400 font-mono">{{ mdPath }}</div>
            </div>
        </header>

        <!-- Content -->
        <main class="max-w-4xl mx-auto px-6 py-8">
            <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 text-gray-400">
                <svg class="animate-spin h-8 w-8 text-indigo-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading...</span>
            </div>

            <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-red-500">
                <svg class="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <span class="text-lg font-medium">{{ error }}</span>
                <NuxtLink to="/" class="mt-4 text-indigo-600 hover:underline">Return to Editor</NuxtLink>
            </div>

            <article v-else class="markdown-body bg-white rounded-2xl shadow-sm border border-gray-100 p-8" v-html="markdownContent"></article>
        </main>
    </div>
</template>

<style scoped>
/* Markdown Styles */
.markdown-body {
    color: #374151;
    line-height: 1.8;
    font-size: 1rem;
}

.markdown-body :deep(h1) {
    font-size: 2rem;
    font-weight: 800;
    color: #111827;
    margin: 0 0 1.5rem 0;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid #e5e7eb;
}

.markdown-body :deep(h2) {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
    margin: 2rem 0 1rem 0;
}

.markdown-body :deep(h3) {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin: 1.5rem 0 0.75rem 0;
}

.markdown-body :deep(p) {
    margin: 1rem 0;
}

.markdown-body :deep(hr) {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 2rem 0;
}

.markdown-body :deep(.code-block) {
    background: #1f2937;
    color: #e5e7eb;
    padding: 1.25rem;
    border-radius: 0.75rem;
    overflow-x: auto;
    font-size: 0.875rem;
    margin: 1.5rem 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.markdown-body :deep(.code-block code) {
    background: none;
    padding: 0;
    color: inherit;
}

.markdown-body :deep(.inline-code) {
    background: #f3f4f6;
    color: #e11d48;
    padding: 0.2rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.875em;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.markdown-body :deep(.md-table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
    font-size: 0.9rem;
}

.markdown-body :deep(.md-table td) {
    padding: 0.75rem 1rem;
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
    margin: 1rem 0;
    padding-left: 1.75rem;
}

.markdown-body :deep(.md-list li) {
    margin: 0.5rem 0;
}

.markdown-body :deep(strong) {
    font-weight: 600;
    color: #1f2937;
}
</style>
