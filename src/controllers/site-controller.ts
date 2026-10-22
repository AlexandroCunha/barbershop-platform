import type { Request, Response } from "express";
import type { TenantRepository } from "../repositories/types.js";
import { tenantOf } from "../middlewares/load-tenant.js";

interface SiteControllerOptions {
  tenants: TenantRepository;
  /** Shop shown on the home page. When unset, the first shop created is used. */
  homeShopSlug: string | undefined;
}

/** Public business profile of one barbershop, and the shop the home page opens. */
export class SiteController {
  private readonly tenants: TenantRepository;
  private readonly homeShopSlug: string | undefined;

  constructor(options: SiteControllerOptions) {
    this.tenants = options.tenants;
    this.homeShopSlug = options.homeShopSlug;
  }

  business = (req: Request, res: Response): void => {
    res.json(tenantOf(req).business);
  };

  home = async (_req: Request, res: Response): Promise<void> => {
    const slug = this.homeShopSlug ?? (await this.tenants.findFirstSlug());
    res.json({ slug: slug ?? null });
  };
}
