export async function wait(durationMs) {
    return new Promise((resolve, _) => {
        setTimeout(() => resolve(), durationMs);
    });
}
