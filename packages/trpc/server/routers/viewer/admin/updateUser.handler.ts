import { prisma } from "@calcom/prisma";
import { Prisma } from "@calcom/prisma/client";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../types";
import type { TAdminUpdateUserSchema } from "./updateUser.schema";

type UpdateOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TAdminUpdateUserSchema;
};

const updateUserHandler = async ({ input }: UpdateOptions) => {
  const { userId, ...rest } = input;

  const updateData: Prisma.UserUpdateInput = {};

  if (rest.name !== undefined) updateData.name = rest.name;
  if (rest.username !== undefined) updateData.username = rest.username;
  if (rest.email !== undefined) updateData.email = rest.email;
  if (rest.timeZone !== undefined) updateData.timeZone = rest.timeZone;
  if (rest.role !== undefined) updateData.role = rest.role;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        timeZone: true,
        role: true,
        locked: true,
      },
    });

    return updatedUser;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    throw error;
  }
};

export default updateUserHandler;
