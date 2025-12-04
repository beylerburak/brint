/**
 * User Domain Entity
 * 
 * Domain-level representation of a User, independent of database schema.
 * Contains business rules and validation logic.
 */

import type { TimezonePreference, DateFormat, TimeFormat } from '@prisma/client';

export type UserProps = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  timezonePreference: TimezonePreference;
  timezone?: string | null;
  locale?: string | null;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  phoneNumber?: string | null;
  phoneVerifiedAt?: Date | null;
  settings?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
};

export class UserEntity {
  public readonly id: string;
  public readonly email: string;
  public readonly name: string | null;
  public readonly avatarUrl: string | null;
  public readonly timezonePreference: TimezonePreference;
  public readonly timezone: string | null;
  public readonly locale: string | null;
  public readonly dateFormat: DateFormat;
  public readonly timeFormat: TimeFormat;
  public readonly phoneNumber: string | null;
  public readonly phoneVerifiedAt: Date | null;
  public readonly settings: Record<string, any> | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name ?? null;
    this.avatarUrl = props.avatarUrl ?? null;
    this.timezonePreference = props.timezonePreference;
    this.timezone = props.timezone ?? null;
    this.locale = props.locale ?? null;
    this.dateFormat = props.dateFormat;
    this.timeFormat = props.timeFormat;
    this.phoneNumber = props.phoneNumber ?? null;
    this.phoneVerifiedAt = props.phoneVerifiedAt ?? null;
    this.settings = props.settings ?? null;
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
    avatarUrl: string | null;
    timezonePreference: TimezonePreference;
    timezone: string | null;
    locale: string | null;
    dateFormat: DateFormat;
    timeFormat: TimeFormat;
    phoneNumber: string | null;
    phoneVerifiedAt: Date | null;
    settings: any;
    createdAt: Date;
    updatedAt: Date;
  }): UserEntity {
    return new UserEntity({
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name,
      avatarUrl: prismaUser.avatarUrl,
      timezonePreference: prismaUser.timezonePreference,
      timezone: prismaUser.timezone,
      locale: prismaUser.locale,
      dateFormat: prismaUser.dateFormat,
      timeFormat: prismaUser.timeFormat,
      phoneNumber: prismaUser.phoneNumber,
      phoneVerifiedAt: prismaUser.phoneVerifiedAt,
      settings: prismaUser.settings as Record<string, any> | null,
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
      avatarUrl: this.avatarUrl,
      timezonePreference: this.timezonePreference,
      timezone: this.timezone,
      locale: this.locale,
      dateFormat: this.dateFormat,
      timeFormat: this.timeFormat,
      phoneNumber: this.phoneNumber,
      phoneVerifiedAt: this.phoneVerifiedAt,
      settings: this.settings,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

