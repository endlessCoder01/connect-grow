import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "admin@connect.com";
const ADMIN_PASSWORD = "admin123!";
const ADMIN_DISPLAY_NAME = "Admin";

let bootstrapPromise: Promise<void> | undefined;

async function bootstrapAdminUser(): Promise<void> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[Admin bootstrap] Skipping admin seed because SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
    return;
  }

  const { data: usersData, error: usersError } =
    await supabaseAdmin.auth.admin.listUsers();

  if (usersError) {
    throw usersError;
  }

  const existingUser = usersData.users.find(
    (user) => user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
  );

  let userId = existingUser?.id;

  if (!userId) {
    const { data: createData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          display_name: ADMIN_DISPLAY_NAME,
        },
        app_metadata: {
          provider: "email",
          providers: ["email"],
        },
      });

    if (createError) {
      throw createError;
    }

    userId = createData.user?.id;

    if (!userId) {
      throw new Error("Failed to create admin user.");
    }
  } else {
    // Password resets can be rejected by Supabase policies (e.g. leaked-password
    // protection). That must never take down the app, so log and continue.
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true,
        user_metadata: {
          display_name: ADMIN_DISPLAY_NAME,
        },
      });

    if (updateError) {
      console.warn("[Admin bootstrap] Could not update admin user.", updateError.message);
    }
  }

  const [{ error: roleError }, { error: profileError }] = await Promise.all([
    supabaseAdmin.from("user_roles").upsert(
      [
        {
          user_id: userId,
          role: "admin",
        },
        {
          user_id: userId,
          role: "user",
        },
      ],
      {
        onConflict: "user_id,role",
      },
    ),

    supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        display_name: ADMIN_DISPLAY_NAME,
      },
      {
        onConflict: "id",
      },
    ),
  ]);

  if (roleError) {
    throw roleError;
  }

  if (profileError) {
    throw profileError;
  }

  console.info(
    `[Admin bootstrap] Ensured admin user exists: ${ADMIN_EMAIL}`,
  );
}

export function ensureDefaultAdminUser(): Promise<void> {
  if (!bootstrapPromise) {
    // Never reject: this runs before every SSR request, so a failure here must
    // not turn the whole app into a 500.
    bootstrapPromise = bootstrapAdminUser().catch((error) => {
      console.error("[Admin bootstrap] Failed to ensure admin user.", error);
    });
  }

  return bootstrapPromise;
}