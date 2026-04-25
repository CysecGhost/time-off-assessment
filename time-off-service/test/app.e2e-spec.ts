import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Time-Off Microservice (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    await request(app.getHttpServer())
      .post('/sync/batch')
      .send([
        { employeeId: 'emp1', locationId: 'PK', balance: 20 },
        { employeeId: 'emp2', locationId: 'PK', balance: 10 },
        { employeeId: 'emp3', locationId: 'PK', balance: 10 },
      ]);
  });

  afterAll(async () => {
    await app.close();
  });

  // ✅ Happy path: seed balance
  describe('POST /sync/batch', () => {
    it('should sync balances from HCM batch', async () => {
      const res = await request(app.getHttpServer())
        .post('/sync/batch')
        .send([{ employeeId: 'test1', locationId: 'PK', balance: 10 }]);

      expect(res.status).toBe(201);
      expect(res.body.synced).toBe(1);
    });
  });

  // ✅ Happy path: valid request
  describe('POST /requests', () => {
    it('should create a valid leave request', async () => {
      const res = await request(app.getHttpServer()).post('/requests').send({
        employeeId: 'emp1',
        locationId: 'PK',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.validatedLocally).toBe(false);
    });

    // ❌ Failure: past date
    it('should reject request with past start date', async () => {
      const res = await request(app.getHttpServer()).post('/requests').send({
        employeeId: 'emp1',
        locationId: 'PK',
        startDate: '2024-01-01',
        endDate: '2024-01-03',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('past');
    });

    // ❌ Failure: end before start
    it('should reject request where end date is before start date', async () => {
      const res = await request(app.getHttpServer()).post('/requests').send({
        employeeId: 'emp1',
        locationId: 'PK',
        startDate: '2026-06-10',
        endDate: '2026-06-05',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('after start date');
    });

    // ❌ Failure: insufficient balance
    it('should reject request with insufficient balance', async () => {
      const res = await request(app.getHttpServer()).post('/requests').send({
        employeeId: 'emp1',
        locationId: 'PK',
        startDate: '2026-07-01',
        endDate: '2026-07-25',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('balance');
    });

    // ❌ Failure: invalid input
    it('should reject request with missing fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/requests')
        .send({ employeeId: 'emp1' });

      expect(res.status).toBe(400);
    });

    // ⚠️ Edge case: overlapping dates
    it('should reject overlapping leave request', async () => {
      // First request
      await request(app.getHttpServer()).post('/requests').send({
        employeeId: 'emp2',
        locationId: 'PK',
        startDate: '2026-08-01',
        endDate: '2026-08-03',
      });

      // Overlapping second request
      const res = await request(app.getHttpServer()).post('/requests').send({
        employeeId: 'emp2',
        locationId: 'PK',
        startDate: '2026-08-02',
        endDate: '2026-08-05',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Overlapping');
    });
  });

  // ✅ Happy path: get requests
  describe('GET /requests/:employeeId', () => {
    it('should return requests for an employee', async () => {
      const res = await request(app.getHttpServer()).get('/requests/emp1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ✅ Happy path: get balance
  describe('GET /balance/:employeeId/:locationId', () => {
    it('should return balance for an employee', async () => {
      await request(app.getHttpServer())
        .post('/sync/batch')
        .send([{ employeeId: 'baltest', locationId: 'PK', balance: 15 }]);

      const res = await request(app.getHttpServer()).get('/balance/baltest/PK');

      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(15);
    });
  });

  // ✅ Happy path: update status
  describe('PATCH /requests/:id', () => {
    it('should update request status to APPROVED', async () => {
      await request(app.getHttpServer())
        .post('/sync/batch')
        .send([{ employeeId: 'emp3', locationId: 'PK', balance: 10 }]);

      const created = await request(app.getHttpServer())
        .post('/requests')
        .send({
          employeeId: 'emp3',
          locationId: 'PK',
          startDate: '2026-09-01',
          endDate: '2026-09-03',
        });

      const res = await request(app.getHttpServer())
        .patch(`/requests/${created.body.id}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('APPROVED');
    });
  });

  // ⚠️ Edge case: batch sync overwrites local balance
  describe('Batch sync audit', () => {
    it('should overwrite local balance with HCM value', async () => {
      await request(app.getHttpServer())
        .post('/sync/batch')
        .send([{ employeeId: 'auditEmp', locationId: 'PK', balance: 7 }]);

      await request(app.getHttpServer())
        .post('/sync/batch')
        .send([{ employeeId: 'auditEmp', locationId: 'PK', balance: 12 }]);

      const res = await request(app.getHttpServer()).get(
        '/balance/auditEmp/PK',
      );

      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(12);
    });
  });
});
