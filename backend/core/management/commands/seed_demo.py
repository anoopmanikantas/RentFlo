from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.models import AddOn, BankAccount, Building, Payment, Subscription, Tenancy, Unit


class Command(BaseCommand):
    help = "Seed demo landlord, tenants, buildings, and payments."

    def handle(self, *args, **options):
        User = get_user_model()
        if User.objects.filter(username="owner").exists():
            self.stdout.write(self.style.WARNING("Demo data already exists."))
            return

        landlord = User.objects.create_user(
            username="owner",
            password="owner123",
            email="owner@example.com",
            first_name="Anoop",
            last_name="Subramani",
            role=User.Role.LANDLORD,
            phone="+91 98765 43210",
        )

        # Create Pro-tier subscription for the demo landlord (analytics enabled)
        Subscription.objects.create(
            landlord=landlord,
            tier=Subscription.Tier.PRO,
            max_units=25,
            max_tenants=25,
        )

        bank_1 = BankAccount.objects.create(
            landlord=landlord,
            bank_name="HDFC Bank",
            account_name="Anoop Subramani",
            account_number="xxxx4321",
            ifsc="HDFC0000123",
        )
        bank_2 = BankAccount.objects.create(
            landlord=landlord,
            bank_name="ICICI Bank",
            account_name="Anoop Rentals",
            account_number="xxxx9981",
            ifsc="ICIC0000456",
        )

        palm = Building.objects.create(landlord=landlord, name="Palm Residency", address="12 Lake View Road, Bengaluru")
        cedar = Building.objects.create(landlord=landlord, name="Cedar Heights", address="44 MG Street, Bengaluru")

        unit_1 = Unit.objects.create(building=palm, label="Flat 101", monthly_rent=Decimal("22000.00"))
        unit_2 = Unit.objects.create(building=palm, label="Flat 102", monthly_rent=Decimal("24000.00"))
        unit_3 = Unit.objects.create(building=cedar, label="Flat 2A", monthly_rent=Decimal("28000.00"))

        riya = User.objects.create_user(
            username="riya",
            password="tenant123",
            email="riya@example.com",
            first_name="Riya",
            last_name="Sharma",
            role=User.Role.TENANT,
            phone="+91 91234 00001",
        )
        arjun = User.objects.create_user(
            username="arjun",
            password="tenant123",
            email="arjun@example.com",
            first_name="Arjun",
            last_name="Nair",
            role=User.Role.TENANT,
            phone="+91 91234 00002",
        )
        maya = User.objects.create_user(
            username="maya",
            password="tenant123",
            email="maya@example.com",
            first_name="Maya",
            last_name="Patel",
            role=User.Role.TENANT,
            phone="+91 91234 00003",
        )

        tenancy_1 = Tenancy.objects.create(landlord=landlord, tenant_user=riya, unit=unit_1, start_date="2025-07-01")
        Tenancy.objects.create(landlord=landlord, tenant_user=arjun, unit=unit_2, start_date="2025-10-01")
        tenancy_3 = Tenancy.objects.create(landlord=landlord, tenant_user=maya, unit=unit_3, start_date="2025-11-01")

        Payment.objects.create(
            landlord=landlord,
            tenancy=tenancy_1,
            unit=unit_1,
            bank_account=bank_1,
            rent_month="2026-03",
            amount=Decimal("22000.00"),
            paid_on="2026-03-02",
            reference="UTR009912",
            status=Payment.Status.SUCCEEDED,
        )
        Payment.objects.create(
            landlord=landlord,
            tenancy=tenancy_3,
            unit=unit_3,
            bank_account=bank_2,
            rent_month="2026-03",
            amount=Decimal("28000.00"),
            paid_on="2026-03-05",
            reference="CASHBOOK-11",
            status=Payment.Status.SUCCEEDED,
        )

        self.stdout.write(self.style.SUCCESS("Seeded demo data."))
