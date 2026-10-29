const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const attempts = await prisma.attempt.findMany({
      include: {
        studentProfile: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        assessmentDelivery: {
          include: {
            assessment: {
              select: { id: true, title: true, instituteId: true }
            }
          }
        },
        responses: {
          include: {
            evaluation: {
              include: {
                versions: true
              }
            },
            question: {
              select: { id: true, content: true, marks: true }
            }
          }
        },
        documents: true
      },
      take: 5
    });
    console.log('Attempts:', JSON.stringify(attempts, null, 2));

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
