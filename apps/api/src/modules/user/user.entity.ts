/**
 * User Domain Entity
 * 
 * Domain-level representation of a User, independent of database schema.
 * Contains business rules and validation logic.
 */

export type UserProps = {
  id: string;
  email: string;
  name?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class UserEntity {
  public readonly id: string;
  public readonly email: string;
  public readonly name: string | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Creates a UserEntity with validation
   * @throws Error if email is invalid
   */
  static create(props: UserProps): UserEntity {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(props.email)) {
      throw new Error(`Invalid email format: ${props.email}`);
    }

    return new UserEntity(props);
  }

  /**
   * Creates a UserEntity from Prisma User model
   */
  static fromPrisma(prismaUser: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserEntity {
    return new UserEntity({
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    });
  }

  /**
   * Converts entity to plain object
   */
  toJSON(): UserProps {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

