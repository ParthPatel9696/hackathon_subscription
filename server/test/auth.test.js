import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { Customer } from '../src/modules/users/customer.model.js';

const validUser = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'StrongPass!1' };

describe('authentication and authorization', () => {
  it('registers a customer without exposing a password hash', async () => {
    const response = await request(app).post('/api/v1/auth/register').send(validUser);
    expect(response.status).toBe(201);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    expect(response.body.data.user.role).toBe('CUSTOMER');
    expect(await Customer.countDocuments()).toBe(1);
  });

  it('rejects duplicate email addresses', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const response = await request(app).post('/api/v1/auth/register').send(validUser);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('rejects passwords that do not meet requirements', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ ...validUser, password: 'weakpass' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in and protects the current-user endpoint', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const login = await request(app).post('/api/v1/auth/login').send({ email: validUser.email, password: validUser.password });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(validUser.email);
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
  });

  it('allows only admins to create staff accounts', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const login = await request(app).post('/api/v1/auth/login').send({ email: validUser.email, password: validUser.password });
    const forbidden = await request(app).post('/api/v1/auth/staff').set('Authorization', `Bearer ${login.body.data.accessToken}`).send({
      name: 'Staff User', email: 'staff@example.com', password: 'StrongPass!1'
    });
    expect(forbidden.status).toBe(403);
    await User.updateOne({ email: validUser.email }, { role: 'ADMIN' });
    const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: validUser.email, password: validUser.password });
    const created = await request(app).post('/api/v1/auth/staff').set('Authorization', `Bearer ${adminLogin.body.data.accessToken}`).send({
      name: 'Staff User', email: 'staff@example.com', password: 'StrongPass!1'
    });
    expect(created.status).toBe(201);
    expect(created.body.data.user.role).toBe('STAFF');
  });

  it('prevents a customer from reading another customer profile', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    await request(app).post('/api/v1/auth/register').send({ ...validUser, email: 'grace@example.com', name: 'Grace Hopper' });
    const login = await request(app).post('/api/v1/auth/login').send({ email: validUser.email, password: validUser.password });
    const other = await User.findOne({ email: 'grace@example.com' });
    const response = await request(app).get(`/api/v1/customers/${other.id}`).set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(response.status).toBe(403);
  });

  it('consumes password reset tokens once', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ email: validUser.email });
    const token = forgot.body.data.resetToken;
    expect(token).toBeTruthy();
    const reset = await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'NewStrong!1' });
    expect(reset.status).toBe(200);
    const reused = await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'AnotherStrong!1' });
    expect(reused.status).toBe(400);
    expect((await request(app).post('/api/v1/auth/login').send({ email: validUser.email, password: 'NewStrong!1' })).status).toBe(200);
  });
});
