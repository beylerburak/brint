export type SubscriptionPlanValue = "FREE" | "PRO" | "ENTERPRISE";
export type SubscriptionStatusValue = "ACTIVE" | "CANCELED" | "PAST_DUE";

export type SubscriptionProps = {
  id: string;
  workspaceId: string;
  plan: SubscriptionPlanValue;
  status: SubscriptionStatusValue;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  cancelAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class SubscriptionEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly plan: SubscriptionPlanValue;
  public readonly status: SubscriptionStatusValue;
  public readonly periodStart: Date | null;
  public readonly periodEnd: Date | null;
  public readonly cancelAt: Date | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: SubscriptionProps) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.plan = props.plan;
    this.status = props.status;
    this.periodStart = props.periodStart ?? null;
    this.periodEnd = props.periodEnd ?? null;
    this.cancelAt = props.cancelAt ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static fromPrisma(prismaSubscription: SubscriptionProps): SubscriptionEntity {
    return new SubscriptionEntity(prismaSubscription);
  }

  toJSON(): SubscriptionProps {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      plan: this.plan,
      status: this.status,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      cancelAt: this.cancelAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
