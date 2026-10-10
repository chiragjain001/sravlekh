import logging

from prisma import Prisma

logger = logging.getLogger(__name__)

db = Prisma()

async def connect_db():
    if not db.is_connected():
        try:
            await db.connect()
            logger.info("✅ Database connection established.")
        except Exception as e:
            logger.error(f"❌ Failed to connect to database: {e}")
            raise e

async def ensure_db():
    try:
        if not db.is_connected():
            await db.connect()
            logger.info("✅ Database connection established.")
        else:
            # Active heartbeat check to detect closed/dropped remote connections
            await db.execute_raw("SELECT 1")
    except Exception as e:
        logger.warning(f"⚠️ Database connection ping failed ({e}). Re-establishing...")
        try:
            if db.is_connected():
                await db.disconnect()
        except Exception:
            pass
        try:
            await db.connect()
            logger.info("✅ Database connection re-established.")
        except Exception as err:
            logger.error(f"❌ Failed to re-establish database connection: {err}")
            raise err

async def disconnect_db():
    if db.is_connected():
        try:
            await db.disconnect()
            logger.info("🔌 Database connection closed.")
        except Exception as e:
            logger.warning(f"Error during disconnect: {e}")

