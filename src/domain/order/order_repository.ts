import type { Order } from "./order.js";

export abstract class OrderRepository {
    abstract fetchWithId(id: string): Promise<Order | null>;
    abstract save(order: Order): Promise<void>;
}