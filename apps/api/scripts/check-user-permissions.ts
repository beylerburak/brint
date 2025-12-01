import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    const userId = 'cmimp62su0000brm0kjjuqifz';

    // Get user with workspace memberships
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            workspaceMembers: {
                include: {
                    workspace: {
                        include: {
                            roles: {
                                include: {
                                    rolePermissions: {
                                        include: {
                                            permission: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!user) {
        console.log('❌ User not found');
        return;
    }

    console.log('📋 User:', user.email);
    console.log('\n🏢 Workspaces:\n');

    for (const member of user.workspaceMembers) {
        console.log('  Workspace:', member.workspace.name);
        console.log('  Workspace ID:', member.workspaceId);
        console.log('  WorkspaceRole (enum):', member.role);
        console.log('  \n  📜 Available Roles in Workspace:');

        for (const role of member.workspace.roles) {
            console.log('    -', role.name, '(' + role.key + ')');
            console.log('      Permissions:', role.rolePermissions.length);

            // Match role key with workspace role
            if (role.key === `workspace-${member.role.toLowerCase()}`) {
                console.log('      ✅ This matches user\'s WorkspaceRole');
                console.log('      \n      🔐 Claims (Permissions):');
                role.rolePermissions.forEach(rp => {
                    console.log('        -', rp.permission.key);
                });
            }
        }
        console.log('');
    }

    await prisma.$disconnect();
}

check().catch(e => {
    console.error('Error:', e);
    process.exit(1);
});
