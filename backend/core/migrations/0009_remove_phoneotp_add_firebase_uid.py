from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_phoneotp"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="firebase_uid",
            field=models.CharField(blank=True, max_length=128, null=True, unique=True),
        ),
        migrations.DeleteModel(
            name="PhoneOTP",
        ),
    ]
