import type { Dex } from "./dex/dex.js";

export class DexRegistry {
    private readonly _dexes: Map<string, Dex>;

    constructor(
        dexes: Dex[],
    ) {
        this._dexes = new Map<string, Dex>();
        for (const dex of dexes) {
            this._dexes.set(dex.id, dex);
        }
    }

    get dexes(): Dex[] {
        return this._dexes.values().toArray();
    }


    withId(id: string): Dex {
        return this._dexes.get(id)!;
    }
}