export async function wait(durationMs: number): Promise<void> {
    return new Promise((resolve, _) => {
        setTimeout(() => resolve(), durationMs);
    });
}