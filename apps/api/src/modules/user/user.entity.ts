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
  username?: string | null;
  firstOnboardedAt?: Date | null;
  completedOnboarding?: boolean;
  lastLoginAt?: Date | null;
  locale?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
  phone?: string | null;
  status?: string;
  avatarMediaId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class UserEntity {
  public readonly id: string;
  public readonly email: string;
  public readonly name: string | null;
  public readonly username: string | null;
  public readonly firstOnboardedAt: Date | null;
  public readonly completedOnboarding: boolean;
  public readonly lastLoginAt: Date | null;
  public readonly locale: string | undefined;
  public readonly timezone: string | undefined;
  public readonly dateFormat: string | undefined;
  public readonly timeFormat: string | undefined;
  public readonly phone: string | null;
  public readonly status: string | undefined;
  public readonly avatarMediaId: string | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name ?? null;
    this.username = props.username ?? null;
    this.firstOnboardedAt = props.firstOnboardedAt ?? null;
    this.completedOnboarding = props.completedOnboarding ?? false;
    this.lastLoginAt = props.lastLoginAt ?? null;
    this.locale = props.locale;
    this.timezone = props.timezone;
    this.dateFormat = props.dateFormat;
    this.timeFormat = props.timeFormat;
    this.phone = props.phone ?? null;
    this.status = props.status;
    this.avatarMediaId = props.avatarMediaId ?? null;
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
    username: string | null;
    firstOnboardedAt: Date | null;
    completedOnboarding: boolean;
    lastLoginAt: Date | null;
    locale: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    phone: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    avatarMediaId: string | null;
  }): UserEntity {
    return new UserEntity({
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name,
      username: prismaUser.username,
      firstOnboardedAt: prismaUser.firstOnboardedAt,
      completedOnboarding: prismaUser.completedOnboarding,
      lastLoginAt: prismaUser.lastLoginAt,
      locale: prismaUser.locale,
      timezone: prismaUser.timezone,
      dateFormat: prismaUser.dateFormat,
      timeFormat: prismaUser.timeFormat,
      phone: prismaUser.phone,
      status: prismaUser.status,
      avatarMediaId: prismaUser.avatarMediaId,
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
      username: this.username,
      firstOnboardedAt: this.firstOnboardedAt,
      completedOnboarding: this.completedOnboarding,
      lastLoginAt: this.lastLoginAt,
      locale: this.locale,
      timezone: this.timezone,
      dateFormat: this.dateFormat,
      timeFormat: this.timeFormat,
      phone: this.phone,
      status: this.status,
      avatarMediaId: this.avatarMediaId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
