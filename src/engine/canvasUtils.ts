export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement, pixelRatio = window.devicePixelRatio || 1): { width: number; height: number } {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    return { width, height };
}

export function clearCanvas(context: CanvasRenderingContext2D, color = '#07131f'): void {
    context.save();
    context.fillStyle = color;
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    context.restore();
}

export function drawCover(
    context: CanvasRenderingContext2D,
    image: CanvasImageSource,
    destination: { x: number; y: number; width: number; height: number },
): void {
    const sourceSize = getSourceSize(image);
    const sourceWidth = sourceSize.width;
    const sourceHeight = sourceSize.height;

    if (!sourceWidth || !sourceHeight) {
        return;
    }

    const sourceRatio = sourceWidth / sourceHeight;
    const destinationRatio = destination.width / destination.height;
    const sourceCrop = sourceRatio > destinationRatio
        ? { width: sourceHeight * destinationRatio, height: sourceHeight }
        : { width: sourceWidth, height: sourceWidth / destinationRatio };
    const sourceX = (sourceWidth - sourceCrop.width) / 2;
    const sourceY = (sourceHeight - sourceCrop.height) / 2;

    context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceCrop.width,
        sourceCrop.height,
        destination.x,
        destination.y,
        destination.width,
        destination.height,
    );
}

function getSourceSize(image: CanvasImageSource): { width: number; height: number } {
    if (image instanceof HTMLVideoElement) {
        return { width: image.videoWidth, height: image.videoHeight };
    }

    if (image instanceof HTMLImageElement) {
        return { width: image.naturalWidth, height: image.naturalHeight };
    }

    if ('displayWidth' in image && 'displayHeight' in image) {
        return { width: image.displayWidth, height: image.displayHeight };
    }

    if ('width' in image && 'height' in image && typeof image.width === 'number' && typeof image.height === 'number') {
        return { width: image.width, height: image.height };
    }

    return { width: 0, height: 0 };
}
