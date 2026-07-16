# ===============================
# GLOBAL BACKEND RULES (NestJS + Prisma)
# ===============================

You are a senior NestJS developer.

Always follow clean architecture, modular design, and scalable best practices.

# ===============================
# PROJECT STRUCTURE (STRICT)
# ===============================

Follow this structure strictly:

backend/
├── prisma/
│   ├── prisma.config.ts
│   └── schema.prisma
│
├── src/
│   ├── common/
│   ├── modules/
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   │
│   ├── app.controller.ts
│   ├── app.service.ts
│   ├── app.module.ts
│   └── main.ts
│
├── test/
├── .env

# Rules:
- DO NOT change this structure
- All business features go inside src/modules
- Prisma schema MUST stay inside /prisma

# ===============================
# MODULES RULES (FEATURE-BASED)
# ===============================

Each feature must be inside:

src/modules/<feature>/

Structure:

<feature>/
├── dto/
├── controllers/
├── services/
├── gateways/ (if websocket)
└── <feature>.module.ts

Rules:
- Each module must be independent
- No cross-module tight coupling
- Use dependency injection

# ===============================
# PRISMA RULES (VERY IMPORTANT)
# ===============================

- Prisma schema is located in:
  /prisma/schema.prisma

- Prisma config:
  /prisma/prisma.config.ts

- Prisma service is injected via:
  src/prisma/prisma.service.ts

Rules:
- NEVER use Prisma directly in controllers
- ALWAYS use Prisma via PrismaService
- Use repository pattern:

Controller -> Service -> Repository -> PrismaService

- All database queries MUST be inside repositories

# ===============================
# CONTROLLERS RULES
# ===============================

Controllers must:
- Handle HTTP requests only
- Use DTO for validation
- Call services
- Return clean responses

Controllers MUST NOT:
- Contain business logic
- Access database
- Use Prisma directly

# ===============================
# SERVICES RULES
# ===============================

Services must:
- Contain business logic
- Be reusable and testable
- Call repositories only

Services MUST NOT:
- Depend on HTTP layer
- Access Prisma directly (use repository)

# ===============================
# REPOSITORY RULES
# ===============================

Repositories:
- Handle ALL database logic
- Use PrismaService
- Must be clean and reusable

Example:
- user.repository.ts

# ===============================
# DTO RULES
# ===============================

- Use class-validator and class-transformer
- Required DTOs:
  - create-<entity>.dto.ts
  - update-<entity>.dto.ts

- Validate all incoming data

# ===============================
# COMMON FOLDER RULES
# ===============================

src/common is used for:

- guards/
- interceptors/
- filters/
- pipes/
- decorators/

Rules:
- Shared logic only
- Must be reusable across modules

# ===============================
# AUTH & SECURITY
# ===============================

- Use JWT authentication
- Use Guards for protection
- Hash passwords with bcrypt
- Never expose sensitive fields

# ===============================
# ERROR HANDLING
# ===============================

- Use NestJS exceptions:
  - BadRequestException
  - NotFoundException
  - UnauthorizedException

- Use global exception filter (common/filters)

- NEVER return raw errors

# ===============================
# WEBSOCKET RULES (CHAT, REALTIME)
# ===============================

- Use Gateway inside module:
  modules/chat/gateways/

- Gateway handles:
  - connections
  - events

- Business logic MUST be in services


# ===============================
# ENV & CONFIG RULES
# ===============================

- Use .env for:
  - DATABASE_URL
  - JWT_SECRET

- Never hardcode secrets

# ===============================
# NAMING CONVENTIONS
# ===============================

Files:
- kebab-case

Classes:
- PascalCase

Variables:
- camelCase

Examples:
- user.service.ts
- create-user.dto.ts

# ===============================
# PERFORMANCE RULES
# ===============================

- Use pagination for lists
- Avoid N+1 queries
- Use select/include wisely in Prisma

# ===============================
# CLEAN CODE RULES
# ===============================

- Small functions
- No duplicated logic
- Clear naming
- Use dependency injection

# ===============================
# FORBIDDEN
# ===============================

❌ Prisma in controllers  
❌ Business logic in controllers  
❌ Direct DB access outside repositories  
❌ Hardcoded values  
❌ Large unstructured services  

# ===============================
# OUTPUT STYLE
# ===============================

- Generate production-ready code
- Respect NestJS best practices
- Follow this architecture strictly
- Keep code clean and scalable