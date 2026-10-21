import { decoyPasswordHash, hashPassword, needsRehash, verifyPassword } from "../auth/passwords.js";
import { DEFAULT_BUSINESS, DEFAULT_PROFESSIONALS, DEFAULT_SERVICES, TRIAL_DAYS } from "../domain/defaults.js";
import { parseBusiness } from "../domain/business.js";
import type { LicenseStatus, Tenant } from "../domain/tenant.js";
import type { OwnerAccount, OwnerRepository, TenantRepository } from "../repositories/types.js";
import type { LicenseInput, NewTenantInput } from "../validations/accounts.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Owner sign-in, owner password changes and the platform owner's shop management. */
export class AccountService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly owners: OwnerRepository,
    private readonly clock: Clock,
  ) {}

  async signInOwner(tenant: Tenant, email: string, password: string): Promise<OwnerAccount> {
    const owner = await this.owners.findByEmail(tenant.id, email);

    // Always run one hash check, so response time does not reveal which emails exist.
    const storedHash = owner?.passwordHash ?? (await decoyPasswordHash);
    const passwordMatches = await verifyPassword(password, storedHash);

    if (!owner || !passwordMatches) {
      throw new AppError(401, "Email or password is not correct");
    }

    // Upgrade a hash made with older scrypt settings while the correct password is at hand.
    if (needsRehash(owner.passwordHash)) {
      await this.owners.replacePasswordHash(owner.id, await hashPassword(password));
    }
    return owner;
  }

  /** Returns the owner's new session version, which invalidates the old sessions. */
  async changeOwnerPassword(owner: OwnerAccount, current: string, next: string): Promise<number> {
    if (!(await verifyPassword(current, owner.passwordHash))) {
      throw new AppError(400, "The current password is not correct");
    }
    return this.owners.updatePassword(owner.id, await hashPassword(next));
  }

  async createTenant(input: NewTenantInput): Promise<Tenant> {
    const now = this.clock.now();
    return this.tenants.create({
      slug: input.slug,
      name: input.name,
      business: parseBusiness({ ...DEFAULT_BUSINESS, name: input.name }),
      licenseStatus: "trial",
      trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * DAY_MS),
      ownerEmail: input.ownerEmail,
      ownerPasswordHash: await hashPassword(input.ownerPassword),
      services: DEFAULT_SERVICES,
      professionals: DEFAULT_PROFESSIONALS,
    });
  }

  listTenants(): Promise<Tenant[]> {
    return this.tenants.listAll();
  }

  async setLicense(id: number, input: LicenseInput): Promise<Tenant> {
    const status: LicenseStatus = input.status;
    const tenant = await this.tenants.updateLicense(id, {
      licenseStatus: status,
      trialEndsAt: input.trialEndsAt,
      paidUntil: input.paidUntil,
    });
    if (!tenant) {
      throw new AppError(404, "Barbershop not found");
    }
    return tenant;
  }
}
