import { loadLocalEnv } from "../config/load-env.js";
import { createPool } from "../db/pool.js";
import { PgOwnerRepository } from "../repositories/pg-owner-repository.js";
import { PgTenantRepository } from "../repositories/pg-tenant-repository.js";
import { AccountService } from "../services/account-service.js";
import { systemClock } from "../utils/clock.js";
import { askHidden } from "../utils/prompt.js";
import { parseLicense, parseNewPassword, parseNewTenant } from "../validations/accounts.js";

const USAGE = `Usage:
  npm run shop -- create <address> --name "<Barbershop name>" --owner-email <email>
  npm run shop -- license <address> <trial|active|suspended> [--trial-ends YYYY-MM-DD] [--paid-until YYYY-MM-DD]

The owner's password is typed twice and is never shown or passed as an argument.`;

interface Parsed {
  command: string | undefined;
  positional: string[];
  flags: Record<string, string>;
}

/** Splits "--name value" pairs from the words that come before and after them. */
function parseArguments(argv: string[]): Parsed {
  const [command, ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let index = 0; index < rest.length; index++) {
    const word = rest[index]!;
    if (word.startsWith("--")) {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${word} needs a value.\n\n${USAGE}`);
      }
      flags[word.slice(2)] = value;
      index++;
    } else {
      positional.push(word);
    }
  }
  return { command, positional, flags };
}

async function main(): Promise<void> {
  loadLocalEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Set it to the database you want to change.");
  }

  const { command, positional, flags } = parseArguments(process.argv.slice(2));
  const pool = createPool(databaseUrl);
  try {
    const accounts = new AccountService(new PgTenantRepository(pool), new PgOwnerRepository(pool), systemClock);
    const tenants = new PgTenantRepository(pool);

    if (command === "create") {
      const [slug] = positional;
      if (!slug || !flags.name || !flags["owner-email"]) {
        throw new Error(USAGE);
      }
      const ownerPassword = await askHidden("Owner password (at least 12 characters): ");
      const repeated = await askHidden("Repeat the password: ");
      if (ownerPassword !== repeated) {
        throw new Error("The passwords do not match. Nothing was saved.");
      }
      parseNewPassword(ownerPassword, "password");
      const tenant = await accounts.createTenant(
        parseNewTenant({ name: flags.name, slug, ownerEmail: flags["owner-email"], ownerPassword }),
      );
      console.log(`Barbershop created: /${tenant.slug} (${tenant.name}), with a 14-day trial.`);
      console.log(`Owner area: /${tenant.slug}/admin`);
      return;
    }

    if (command === "license") {
      const [slug, status] = positional;
      if (!slug || !status) {
        throw new Error(USAGE);
      }
      const tenant = await tenants.findBySlug(slug.toLowerCase());
      if (!tenant) {
        throw new Error(`No barbershop has the address /${slug}.`);
      }
      const updated = await accounts.setLicense(
        tenant.id,
        parseLicense({ status, trialEndsAt: flags["trial-ends"] ?? null, paidUntil: flags["paid-until"] ?? null }),
      );
      console.log(`/${updated.slug} licence is now ${updated.licenseStatus}.`);
      return;
    }

    throw new Error(USAGE);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
