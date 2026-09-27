import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('EchoGPT API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health is public and returns 200', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('GET /api/v1/users/me without a token returns 401', () => {
    return request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('GET /api/v1/subscriptions/plans is public and lists plans', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/subscriptions/plans').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});