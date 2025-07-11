import type { User } from "../hooks/useSocket";

export interface SearchResult {
  users: User[];
  count?: number;
  message?: string;
}
export interface message {
  _id?: string;
  recipientId: string;
  senderId: string;
  recipientUsername: string;
  senderUsername: string;
  message: string;
  timestamp: Date;
  status: "sent" | "delivered" | "seen";
}

export interface ChatHistory {
  messages: message[];
  participants: string[];
  count: number;
}
