export type WorkspaceMemberProps = {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRoleValue;
  invitedBy?: string | null;
  invitedAt?: Date | null;
  joinedAt?: Date | null;
  status: string;
  createdAt: Date;
};

export type WorkspaceRoleValue = "OWNER" | "ADMIN" | "MEMBER";

export class WorkspaceMemberEntity {
  public readonly id: string;
  public readonly userId: string;
  public readonly workspaceId: string;
  public readonly role: WorkspaceRoleValue;
  public readonly invitedBy: string | null;
  public readonly invitedAt: Date | null;
  public readonly joinedAt: Date | null;
  public readonly status: string;
  public readonly createdAt: Date;

  private constructor(props: WorkspaceMemberProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.workspaceId = props.workspaceId;
    this.role = props.role;
    this.invitedBy = props.invitedBy ?? null;
    this.invitedAt = props.invitedAt ?? null;
    this.joinedAt = props.joinedAt ?? null;
    this.status = props.status;
    this.createdAt = props.createdAt;
  }

  static fromPrisma(prismaMember: WorkspaceMemberProps): WorkspaceMemberEntity {
    return new WorkspaceMemberEntity(prismaMember);
  }

  toJSON(): WorkspaceMemberProps {
    return {
      id: this.id,
      userId: this.userId,
      workspaceId: this.workspaceId,
      role: this.role,
      invitedBy: this.invitedBy,
      invitedAt: this.invitedAt,
      joinedAt: this.joinedAt,
      status: this.status,
      createdAt: this.createdAt,
    };
  }
}
