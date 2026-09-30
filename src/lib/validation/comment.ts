import { z } from "zod";

import {
  ACTIVITY_ENTITY_TYPES,
} from "@/modules/activity/entity-types";

export const commentEntityTypeSchema =
  z.enum(
    ACTIVITY_ENTITY_TYPES,
  );

export const createCommentSchema =
  z.object({
    entityType:
      commentEntityTypeSchema,

    entityId:
      z.string().uuid(),

    body: z
      .string()
      .trim()
      .min(
        1,
        "Введите текст комментария.",
      )
      .max(
        4000,
        "Комментарий не должен превышать 4000 символов.",
      ),
  });

export const updateCommentSchema =
  z.object({
    commentId:
      z.string().uuid(),

    version: z.coerce
      .number()
      .int()
      .positive(),

    body: z
      .string()
      .trim()
      .min(
        1,
        "Введите текст комментария.",
      )
      .max(
        4000,
        "Комментарий не должен превышать 4000 символов.",
      ),
  });

export const commentLifecycleSchema =
  z.object({
    commentId:
      z.string().uuid(),

    version: z.coerce
      .number()
      .int()
      .positive(),
  });

export type CommentActionState = {
  success?: boolean;
  message?: string;
  revision?: string;
  values?: {
    body?: string;
  };
  errors?: {
    body?: string[];
  };
};
