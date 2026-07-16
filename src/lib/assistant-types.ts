import type { UIMessage } from "ai";

export type AssistantProject = {
  id: string;
  name: string;
};

export type AssistantConversationSummary = {
  id: string;
  title: string;
  projectId: string | null;
  updatedAt: string;
  messageCount: number;
};

export type AssistantBootstrap = {
  projects: AssistantProject[];
  conversations: AssistantConversationSummary[];
};

export type AssistantConversationDetail = {
  conversation: AssistantConversationSummary;
  messages: UIMessage[];
};
