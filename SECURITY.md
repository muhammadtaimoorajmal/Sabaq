# Security Policy

Sabaq stores accounts and class information, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead: go to the repository's **Security** tab and choose **Report a vulnerability**.

Include the steps to reproduce, the affected page or endpoint, and the impact you expect. You will receive an acknowledgement, and fixes are released as soon as possible.

## Supported versions

Only the latest version on the `main` branch (and the live deployment) receives security fixes.

## Design commitments

- Passwords are hashed with Argon2id and never logged.
- Refresh tokens live in httpOnly, Secure cookies and are rotated on every use.
- Files checked by the Submission Checker are processed in the browser and never uploaded to Sabaq.
- Research data in this repository is anonymized.
