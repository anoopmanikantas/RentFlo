#!/usr/bin/env bash
# Render build script for the Django backend
set -o errexit

pip install --upgrade pip
pip install -r ../requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate

# Seed demo data only on first deploy (skip if users already exist)
python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from core.models import User
if not User.objects.exists():
    from django.core.management import call_command
    call_command('seed_demo')
    print('Demo data seeded.')
else:
    print('Users exist, skipping seed.')
"
