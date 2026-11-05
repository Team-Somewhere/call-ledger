export interface User {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateUserInput = {
  email: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};
