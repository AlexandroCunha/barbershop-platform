import type { Request, Response } from "express";
import { tenantOf } from "../middlewares/load-tenant.js";

/** Public business profile of one barbershop. */
export class SiteController {
  business = (req: Request, res: Response): void => {
    res.json(tenantOf(req).business);
  };
}
