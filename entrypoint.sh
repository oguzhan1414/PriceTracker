#!/bin/sh
# PYTHONPATH'i shell script içinde set ediyoruz — Railway ENV override'ından etkilenmiyor
export PYTHONPATH=/app:/app/backend
exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
