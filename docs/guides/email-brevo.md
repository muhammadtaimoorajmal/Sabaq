# Sending e-mail with Brevo

Sabaq sends three kinds of e-mail: address verification, password reset links and "your password was changed" notices. It works with any SMTP provider; this guide uses [Brevo](https://www.brevo.com/), whose free plan covers a small installation.

> [!TIP]
> You do not need an e-mail provider to develop Sabaq. Without `SMTP_HOST`, the API writes every e-mail, including its link, to the server log.

## 1. Create an account

Sign up at [brevo.com](https://www.brevo.com/) and confirm your own e-mail address.

## 2. Add a sender

1. Open **Senders, domains and dedicated IPs** → **Senders** → **Add a sender**.
2. Enter the name people will see (for example `Sabaq`) and an address you control, then confirm it from the e-mail Brevo sends you.
3. For better delivery, also authenticate your domain under **Domains** (adds SPF, DKIM and DMARC records). Without it, messages are more likely to land in spam.

## 3. Create SMTP credentials

1. Open **SMTP & API** → **SMTP**.
2. Note the server (`smtp-relay.brevo.com`), the port (`587`) and the login shown there.
3. Select **Generate a new SMTP key**, name it `sabaq`, and copy the key. It is shown only once.

## 4. Configure the API

In `apps/api/.env` locally, or in your host's environment settings for a deployment:

```bash
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-smtp-login
SMTP_PASS=your-smtp-key
MAIL_FROM=Sabaq <the-sender-you-verified@example.com>
APP_URL=https://your-sabaq-address.example
```

`MAIL_FROM` must use the sender verified in step 2, and `APP_URL` must be the address of the web app, because links in e-mails point there.

## 5. Test it

Start the API with `npm run dev:api`, then request a password reset for an account that uses your own address:

```bash
curl -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

The e-mail should arrive within a minute. Brevo's **Transactional** → **Logs** page shows every message and whether it was delivered.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Log shows `E-mail delivery failed` with `Invalid login` | `SMTP_USER` must be the SMTP login from step 3 (not your account e-mail), and `SMTP_PASS` the SMTP key |
| Brevo rejects the sender | `MAIL_FROM` does not use a verified sender (step 2) |
| Messages arrive in spam | Authenticate your domain (step 2.3) |
| Links open the wrong site | `APP_URL` is not the web app's public address |
