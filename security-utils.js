export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function inlineString(value) {
    return escapeHtml(JSON.stringify(String(value ?? '')));
}

export function safeImageUrl(value) {
    const rawValue = String(value ?? '');
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(rawValue)) {
        return rawValue;
    }
    try {
        const url = new URL(rawValue);
        return url.protocol === 'https:' ? url.href : '';
    } catch {
        return '';
    }
}
