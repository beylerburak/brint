/**
 * User Repository
 * 
 * Data access layer for User entities using Prisma.
 * Handles all database operations related to users.
 */

import { prisma } from '../../lib/prisma.js';
import { UserEntity } from './user.entity.js';
import { Prisma } from '@prisma/client';

export class UserRepository {
  /**
   * Finds a user by ID
   * @returns UserEntity or null if not found
   */
  async findUserById(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return UserEntity.fromPrisma(user);
  }

  /**
   * Finds a user by email
   * @returns UserEntity or null if not found
   */
  async findUserByEmail(email: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    return UserEntity.fromPrisma(user);
  }

  /**
   * Creates a new user
   * @param data User creation data
   * @returns Created UserEntity
   * @throws Error if email already exists or validation fails
   */
  async createUser(data: {
    email: string;
    name?: string | null;
  }): Promise<UserEntity> {
    try {
      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name ?? null,
        },
      });

      return UserEntity.fromPrisma(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error(`User with email ${data.email} already exists`);
      }
      throw error;
    }
  }
}

// Export singleton instance
export const userRepository = new UserRepository();

