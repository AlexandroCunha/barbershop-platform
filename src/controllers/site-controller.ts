import type { Request, Response } from "express";
import type { BusinessProvider } from "../content/business-store.js";

/** Public, read-only business profile used by the website. */
export class SiteController {
  constructor(private readonly provider: BusinessProvider) {}

  business = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.provider.read());
  };
}
