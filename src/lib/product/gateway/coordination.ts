import type { ProductSnapshot } from "./contracts";

export class ProductOperationSupersededError extends Error {
  readonly code = "PRODUCT_OPERATION_SUPERSEDED";

  constructor() {
    super("La operación fue reemplazada por un cambio de sesión más reciente.");
    this.name = "ProductOperationSupersededError";
  }
}

export class ProductSessionUnavailableError extends Error {
  readonly status = 401;
  readonly code = "SESSION_REQUIRED";

  constructor() {
    super("El backoffice no confirmó una sesión autenticada.");
    this.name = "ProductSessionUnavailableError";
  }
}

export interface ProductRequestScope {
  readonly signal: AbortSignal;
  isCurrent(): boolean;
  assertCurrent(): void;
  close(): void;
}

/**
 * Coordinates async UI requests around authentication boundaries. Advancing
 * the epoch aborts every older request, while `isCurrent` also protects state
 * when an injected transport ignores AbortSignal.
 */
export class ProductRequestEpoch {
  private epoch = 0;
  private readonly controllers = new Set<AbortController>();

  open(): ProductRequestScope {
    const controller = new AbortController();
    const openedAt = this.epoch;
    this.controllers.add(controller);
    let closed = false;

    const isCurrent = () =>
      !closed && !controller.signal.aborted && openedAt === this.epoch;

    return {
      signal: controller.signal,
      isCurrent,
      assertCurrent: () => {
        if (!isCurrent()) throw new ProductOperationSupersededError();
      },
      close: () => {
        if (closed) return;
        closed = true;
        this.controllers.delete(controller);
      },
    };
  }

  advance() {
    this.epoch += 1;
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }

  advanceAndOpen() {
    this.advance();
    return this.open();
  }
}

export function requireAuthenticatedProductSnapshot(
  snapshot: ProductSnapshot,
): ProductSnapshot & { session: NonNullable<ProductSnapshot["session"]> } {
  if (!snapshot.session) throw new ProductSessionUnavailableError();
  return snapshot as ProductSnapshot & {
    session: NonNullable<ProductSnapshot["session"]>;
  };
}
