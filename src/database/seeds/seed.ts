import * as bcrypt from 'bcryptjs';
import dataSource from '../data-source';
import { Role } from '../../modules/users/entities/role.entity';
import { User } from '../../modules/users/entities/user.entity';
import { Plan } from '../../modules/subscriptions/entities/plan.entity';
import { Subscription } from '../../modules/subscriptions/entities/subscription.entity';
import { RoleName, SubscriptionStatus } from '../../common/enums';

/**
 * Idempotent seed: safe to run many times, never creates duplicates.
 * Creates roles, Free/Premium plans, and the first admin (from .env).
 */
async function seed() {
  // 1. Read admin credentials from .env and stop early if they're missing
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  // 2. Connect to the database
  await dataSource.initialize();

  // 3. Do everything inside ONE transaction: all or nothing
  await dataSource.transaction(async (manager) => {
    // ── Roles ──
    await manager.upsert(
      Role,
      [
        { name: RoleName.ADMIN, description: 'Full access to admin APIs' },
        { name: RoleName.USER, description: 'Regular extension user' },
      ],
      ['name'],
    );

    // ── Plans (null limit = unlimited) ──
    await manager.upsert(
      Plan,
      [
        {
          code: 'FREE',
          name: 'Free',
          description: 'Basic access with daily limits',
          priceCents: 0,
          dailyChatLimit: 20,
          dailySearchLimit: 10,
        },
        {
          code: 'PREMIUM',
          name: 'Premium',
          description: 'Unlimited chat and search, premium models',
          priceCents: 999,
          dailyChatLimit: null,
          dailySearchLimit: null,
        },
      ],
      ['code'],
    );

    // ── First admin: only if it doesn't exist yet ──
    const existing = await manager.findOneBy(User, { email: adminEmail });
    if (existing) {
      console.log(`Admin ${adminEmail} already exists, skipping`);
      return;
    }

    const adminRole = await manager.findOneByOrFail(Role, { name: RoleName.ADMIN });
    const premiumPlan = await manager.findOneByOrFail(Plan, { code: 'PREMIUM' });

    const admin = await manager.save(
      manager.create(User, {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        fullName: 'System Admin',
        isEmailVerified: true,
        roleId: adminRole.id,
      }),
    );

    await manager.save(
      manager.create(Subscription, {
        userId: admin.id,
        planId: premiumPlan.id,
        status: SubscriptionStatus.ACTIVE,
      }),
    );

    console.log(`Admin created: ${adminEmail}`);
  });

  // 4. Close the connection so the script can exit
  await dataSource.destroy();
}

seed()
  .then(() => {
    console.log('Seeding complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });