import sys
import os
sys.path.insert(0, os.path.abspath('apps/api-python'))
try:
    import src.main
    print("Python src.main imported successfully!")
except Exception as e:
    print(f"Failed to import src.main: {e}")
    import traceback
    traceback.print_exc()

