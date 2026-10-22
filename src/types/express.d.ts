import type { BarberAccount, OwnerAccount } from "../repositories/types.js";
import type { Tenant } from "../domain/tenant.js";

declare global {
  namespace Express {
    interface Request {
      /** The barbershop named in the URL, set by loadTenant. */
      tenant?: Tenant;
      /** The signed-in owner of that shop, set by requireOwner. */
      owner?: OwnerAccount;
      /** The barber signed in to their own area of that shop, set by requireBarber. */
      barber?: BarberAccount;
    }
  }
}

export {};
