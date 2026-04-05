import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';

import { UserRole } from '@generated/enums';

import { PrismaModule, PrismaService } from 'src/prisma';
import { AuthModule } from '../../auth.module';
import { AuthService } from '../../auth.service';
import { registerDto } from '../fixtures/user.fixture';

const testConfig = () => ({
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/test',
  PORT: 3000,
  JWT_SECRET: 'integration-jwt-secret',
  JWT_EXPIRES_IN: '15m',
  JWT_SECRET_REFRESH: 'integration-refresh-secret',
  JWT_SECRET_REFRESH_EXPIRES_IN: 7,
  NODE_ENV: 'test',
});

function createPrismaStub() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('AuthModule (integration)', () => {
  let moduleRef: TestingModule | undefined;
  let prismaStub: ReturnType<typeof createPrismaStub>;

  beforeEach(async () => {
    prismaStub = createPrismaStub();

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [testConfig],
        }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        PrismaModule,
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();
  });

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  it('compiles and wires AuthService', () => {
    const authService = moduleRef!.get(AuthService);
    expect(authService).toBeInstanceOf(AuthService);
  });

  it('register hits prisma through real AuthService', async () => {
    prismaStub.user.findUnique.mockResolvedValue(null);
    prismaStub.user.create.mockResolvedValue({
      id: 'new-id',
      email: registerDto().email,
      passwordHash: 'hidden',
      fullName: 'Test User',
      phone: null,
      role: UserRole.CUSTOMER,
    });

    const authService = moduleRef!.get(AuthService);
    const result = await authService.register(registerDto());

    expect(result).toMatchObject({
      id: 'new-id',
      email: registerDto().email,
      fullName: 'Test User',
    });
    expect(prismaStub.user.create).toHaveBeenCalled();
  });
});
