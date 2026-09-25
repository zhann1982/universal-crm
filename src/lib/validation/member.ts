import { z } from "zod";

export const memberIdSchema =
  z.string().uuid();

export const roleIdSchema =
  z.string().uuid();

export const updateMemberRolesSchema =
  z.object({
    memberId: memberIdSchema,

    roleIds: z
      .array(roleIdSchema)
      .min(
        1,
        "У сотрудника должна быть хотя бы одна роль",
      )
      .max(20),
  });