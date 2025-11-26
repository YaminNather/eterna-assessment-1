export class DexRegistry {
    constructor(dexes) {
        this._dexes = new Map();
        for (const dex of dexes) {
            this._dexes.set(dex.id, dex);
        }
    }
    get dexes() {
        return this._dexes.values().toArray();
    }
    withId(id) {
        return this._dexes.get(id);
    }
}
