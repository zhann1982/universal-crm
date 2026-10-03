import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

const actorSchema = z.object({ organizationId: z.uuid(), memberId: z.uuid() });
type MutationActor = z.infer<typeof actorSchema>;
const context = new AsyncLocalStorage<MutationActor>();

export function getActivityActor() {
  return context.getStore();
}

// Call only after requireMutationPermission, around one awaited business write.
// The Neon adapter installs this server-derived identity transaction-locally.
export async function recordMutation<T>(actor: MutationActor, write: () => PromiseLike<T>): Promise<T> {
  return context.run(actorSchema.parse(actor), async () => await write());
}
