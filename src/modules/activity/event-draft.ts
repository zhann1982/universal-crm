export type ActivityEventDraft = {
  eventType: string;
  summary: string;
  details?: string | null;
  commentId?: string | null;
};
