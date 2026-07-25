import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/generated/prisma/enums";
import type { CustomRole } from "@/lib/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      customRole: CustomRole | null;
    };
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: Role;
    customRoleId: string | null;
  }
}
