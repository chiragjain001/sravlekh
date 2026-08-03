from prisma import Prisma
import logging

logger = logging.getLogger(__name__)

db = Prisma()

async def connect_db():
    try:
        await db.connect()
        logger.info("✅ Database connection established.")
    except Exception as e:
        logger.error(f"❌ Failed to connect to database: {e}")
        raise e

async def disconnect_db():
    await db.disconnect()
    logger.info("🔌 Database connection closed.")
