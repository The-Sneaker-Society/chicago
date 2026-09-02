import dotenv from "dotenv";

dotenv.config({ path: "config.env" });

import { clerkClient } from "@clerk/express";

/**
 * One-off migration: copy unsafeMetadata.role -> publicMetadata.role for
 * every Clerk user, then remove the role key from unsafeMetadata.
 * Idempotent — users already migrated are counted as skipped.
 */
async function migrateRoleToPublicMetadata() {
  let migrated = 0;
  let skippedNoRole = 0;
  let errors = 0;
  let offset = 0;
  const limit = 100;
  let page;

  try {
    do {
      page = await clerkClient.users.getUserList({ limit, offset });
      offset += limit;

      for (const user of page) {
        const role = user.unsafeMetadata?.role;

        if (!role) {
          skippedNoRole += 1;
          continue;
        }

        try {
          const nextPublicMetadata = {
            ...(user.publicMetadata || {}),
            role,
          };
          const nextUnsafeMetadata = { ...(user.unsafeMetadata || {}) };
          delete nextUnsafeMetadata.role;

          await clerkClient.users.updateUser(user.id, {
            publicMetadata: nextPublicMetadata,
            unsafeMetadata: nextUnsafeMetadata,
          });

          migrated += 1;
          console.log(`Migrated ${user.id}: role "${role}" -> publicMetadata`);
        } catch (err) {
          errors += 1;
          console.error(`Error migrating user ${user.id}:`, err.message);
          if (err.errors) {
            console.error("Clerk error details:", err.errors);
          }
        }
      }
    } while (page.length === limit);

    console.log(
      `Migration complete. migrated=${migrated} skipped-no-role=${skippedNoRole} errors=${errors}`
    );
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    if (error.errors) {
      console.error("Clerk error details:", error.errors);
    }
    process.exit(1);
  }
}

migrateRoleToPublicMetadata();
