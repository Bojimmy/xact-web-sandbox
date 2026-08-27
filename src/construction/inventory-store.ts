import type { Product } from "./contracts";

/** Deterministic local state used by the constructed inventory application. */
export class InventoryStore {
  private products: Product[];

  constructor(initial: Product[]) {
    this.products = initial.map((product) => ({ ...product }));
  }

  list(lowStockOnly = false): Product[] {
    return this.products
      .filter((product) => !lowStockOnly || product.quantity < product.reorderPoint)
      .map((product) => ({ ...product }));
  }

  create(product: Product): void {
    if (!product.id || !product.name || product.quantity < 0 || product.unitPrice < 0 || product.reorderPoint < 0) {
      throw new Error("Product schema validation failed.");
    }
    if (this.products.some((existing) => existing.id === product.id)) throw new Error("Product id already exists.");
    this.products.push({ ...product });
  }

  adjustQuantity(id: string, delta: number): void {
    const product = this.products.find((candidate) => candidate.id === id);
    if (!product) throw new Error("Unknown product.");
    if (!Number.isFinite(delta) || product.quantity + delta < 0) throw new Error("Quantity adjustment is invalid.");
    product.quantity += delta;
  }

  totalInventoryValue(): number {
    return this.products.reduce((total, product) => total + product.quantity * product.unitPrice, 0);
  }
}
