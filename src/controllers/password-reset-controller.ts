import type { Request, Response } from "express";
import { tenantOf } from "../middlewares/load-tenant.js";
import { parseResetConfirm, parseResetRequest } from "../validations/accounts.js";
import type { PasswordResetService, ResetArea } from "../services/password-reset-service.js";

export class PasswordResetController {
  constructor(
    private readonly resets: PasswordResetService,
    private readonly report: (message: string, error: unknown) => void = (message, error) => console.error(message, error),
  ) {}

  requestOwner = (req: Request, res: Response): void => this.request("owner", req, res);

  requestBarber = (req: Request, res: Response): void => this.request("barber", req, res);

  /**
   * Answers before any lookup or mail, so the reply takes the same time whether or not the e-mail has an
   * account. The work happens afterwards; its failures are logged, not shown.
   */
  private request(area: ResetArea, req: Request, res: Response): void {
    const tenant = tenantOf(req);
    const email = parseResetRequest(req.body);
    res.status(202).json({ ok: true });
    this.resets.request(tenant, area, email).catch((error: unknown) => this.report("Password reset e-mail failed", error));
  }

  confirm = async (req: Request, res: Response): Promise<void> => {
    const { token, password } = parseResetConfirm(req.body);
    await this.resets.confirm(tenantOf(req), token, password);
    res.json({ ok: true });
  };
}
