import { z } from "zod";

export const memberIdSchema =
  z.string().uuid();

export const roleIdSchema =
  z.string().uuid();

export const memberStatusSchema =
  z.enum([
    "active",
    "inactive",
  ]);

export const addMemberSchema =
  z.object({
    email: z
      .string()
      .trim()
      .email()
      .max(320),

    roleId:
      roleIdSchema,
  });

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

export const updateMemberStatusSchema =
  z.object({
    memberId:
      memberIdSchema,

    status:
      memberStatusSchema,
  });