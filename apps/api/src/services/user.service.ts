import { count, desc, eq } from "drizzle-orm";
import { db, users } from "@call-ledger/database";
import type { ApiPaginationMeta } from "@call-ledger/shared";

export interface GetUsersQuery {
  page: number;
  limit: number;
}

export async function findUsers(query: GetUsersQuery) {
  const { page, limit } = query;
  const offset = (page - 1) * limit;

  const [totalResult] = await db.select({ total: count() }).from(users);
  const total = Number(totalResult?.total || 0);

  const data = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const meta: ApiPaginationMeta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };

  return { data, meta };
}

export async function findUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user || null;
}
