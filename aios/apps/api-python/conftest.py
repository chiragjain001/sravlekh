# Ensures `apps/api-python` (the src/ package's parent) is on sys.path for pytest,
# matching how uvicorn runs this service (`uvicorn src.main:app` from this directory).
