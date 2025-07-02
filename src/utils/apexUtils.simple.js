// Simplified version for debugging

/**
 * Check if content is a patch note or game update
 */
function isPatchNote(title, content) {
    const patchKeywords = [
        'patch notes', 'update', 'hotfix', 'balance changes', 'bug fixes',
        'season', 'legend', 'weapon changes', 'map update'
    ];

    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();

    return patchKeywords.some(keyword =>
        titleLower.includes(keyword) || contentLower.includes(keyword)
    );
}

/**
 * Format content for Discord display
 */
function formatContent(content) {
    if (!content) return '';

    return content
        .replace(/\*\*(.*?)\*\*/g, '**$1**') // Preserve bold
        .replace(/\*(.*?)\*/g, '*$1*') // Preserve italic
        .replace(/```(.*?)```/gs, '```$1```') // Preserve code blocks
        .replace(/`(.*?)`/g, '`$1`') // Preserve inline code
        .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
        .trim();
}

/**
 * Filter patch notes based on provided criteria
 */
function filterPatchNotes(patchNotes, filters) {
    let filtered = [...patchNotes];

    // Filter by keyword
    if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        filtered = filtered.filter(note =>
            note.title.toLowerCase().includes(keyword) ||
            note.content.toLowerCase().includes(keyword) ||
            (note.tags && note.tags.some(tag => tag.toLowerCase().includes(keyword)))
        );
    }

    // Filter by days ago
    if (filters.daysAgo) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - filters.daysAgo);
        filtered = filtered.filter(note => new Date(note.date) >= cutoffDate);
    }

    // Limit count
    if (filters.count) {
        filtered = filtered.slice(0, filters.count);
    }

    return filtered;
}

/**
 * Mock function for getCachedPatchNotes
 */
async function getCachedPatchNotes() {
    return [];
}

export {
    isPatchNote,
    formatContent,
    filterPatchNotes,
    getCachedPatchNotes
};
