# Privacy and security

This is an unofficial, local-only exporter. Only access books and local accounts you are authorized to read.

- Database connections use OPEN_READONLY, query_only and a read transaction.
- Account identifiers are discovered from local application logs; a database key is derived in memory. Keys and full log contents are not exported.
- Export results contain private manuscripts, chapter identifiers and a local profile hash. Treat the entire export folder as private. Do not attach it to public issues.
- The exporter has no networking code. If an AI assistant reads exports, those contents enter its conversation and follow the assistant provider's data handling rules.
- The repository and tests contain only code and synthetic text. Never contribute real databases, logs, credentials, manuscript excerpts or account identifiers.
- For bug reports, share the app version, Node version and a redacted error. Review local paths and identifiers before posting.

The MIT license covers this project's code only. YuewenEdit and its dependencies retain their own licenses; their native modules are not redistributed here.
