export const IMAGE_LIMITS = Object.freeze({
    maxUploadBytes: 30 * 1024 * 1024,
    maxInputPixels: 80_000_000,
    fullMaxDimension: 1800,
    thumbnailMaxDimension: 360,
    fullQuality: 0.82,
    thumbnailQuality: 0.72
});

export function calculateContainDimensions(width, height, maxDimension) {
    const safeWidth = Number(width);
    const safeHeight = Number(height);
    const safeMax = Number(maxDimension);
    if (![safeWidth, safeHeight, safeMax].every(Number.isFinite)
        || safeWidth <= 0 || safeHeight <= 0 || safeMax <= 0) {
        throw new Error('圖片尺寸無效。');
    }
    const scale = Math.min(1, safeMax / Math.max(safeWidth, safeHeight));
    return {
        width: Math.max(1, Math.round(safeWidth * scale)),
        height: Math.max(1, Math.round(safeHeight * scale))
    };
}

export function validateImageFile(file) {
    const fileType = String(file?.type || '').toLowerCase();
    if (!file || !fileType.startsWith('image/') || fileType === 'image/svg+xml') {
        throw new Error('請選擇有效的圖片檔案。');
    }
    if (Number(file.size) > IMAGE_LIMITS.maxUploadBytes) {
        throw new Error('單張圖片不可超過 30MB。');
    }
}

function canvasToWebp(canvas, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('瀏覽器無法轉換此圖片，請改用 JPG、PNG 或 WebP。'));
        }, 'image/webp', quality);
    });
}

async function loadDrawable(file) {
    if (typeof createImageBitmap === 'function') {
        let image;
        try {
            image = await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
            image = await createImageBitmap(file);
        }
        return { image, width: image.width, height: image.height, cleanup: () => image.close() };
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('無法讀取此圖片，請改用 JPG、PNG 或 WebP。'));
        };
        image.src = objectUrl;
    });
    return {
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(objectUrl)
    };
}

async function renderVariant(drawable, maxDimension, quality) {
    const dimensions = calculateContainDimensions(drawable.width, drawable.height, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('瀏覽器無法處理圖片。');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(drawable.image, 0, 0, dimensions.width, dimensions.height);
    return {
        blob: await canvasToWebp(canvas, quality),
        ...dimensions
    };
}

export async function optimizeImage(file) {
    validateImageFile(file);
    let drawable;
    try {
        drawable = await loadDrawable(file);
        if (drawable.width * drawable.height > IMAGE_LIMITS.maxInputPixels) {
            throw new Error('圖片解析度過高，請先縮小到 8,000 萬像素以下。');
        }
        const full = await renderVariant(drawable, IMAGE_LIMITS.fullMaxDimension, IMAGE_LIMITS.fullQuality);
        const thumbnail = await renderVariant(drawable, IMAGE_LIMITS.thumbnailMaxDimension, IMAGE_LIMITS.thumbnailQuality);
        return { full, thumbnail, originalBytes: file.size };
    } catch (error) {
        if (error instanceof Error && /圖片|瀏覽器/.test(error.message)) throw error;
        throw new Error('無法處理此圖片，請改用 JPG、PNG 或 WebP。');
    } finally {
        drawable?.cleanup();
    }
}
