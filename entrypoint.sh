#!/bin/sh
export PYTHONPATH=/app
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}