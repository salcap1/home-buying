# Security Policy

## Supported versions

Security fixes are accepted against the latest commit on `main` (currently released as [v1.0.0](https://github.com/salcap1/home-buying/releases/tag/v1.0.0)).

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Email the maintainer with:

- A short description of the issue
- Steps to reproduce (or a proof of concept)
- Impact (what an attacker could do)
- Any suggested fix, if you have one

Use the email on the GitHub profile for [@salcap1](https://github.com/salcap1), or open a private security advisory on the repository if GitHub Advisories are enabled.

You should hear back within a few days. Please give a reasonable window before any public disclosure so a fix can ship.

## Scope notes

This app stores board data (including password hashes) in Neon and signs unlock cookies with `SESSION_SECRET`. Reports involving auth bypass, session forgery, cross-board data access, or secret exposure are especially welcome.

Out of scope for this policy: third-party listing site scraping reliability, and denial-of-service against dependency or hosting vendors.
