import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../app.js';
import Department from '../models/Department.js';
import Student from '../models/Student.js';

const report = [];
let mongo;
let department;

const unique = randomUUID().replaceAll('-', '').toUpperCase();
const student = {
  studentId: `TST${unique.slice(0, 12)}`,
  name: 'API Test Student',
  email: `api-test-${unique.toLowerCase()}@example.test`,
  section: 'A',
  semester: 1
};
let created;

async function expectStatus(api, method, endpoint, expected, send) {
  const response = await send();
  report.push({
    api,
    method,
    result: response.status === expected ? 'PASS' : 'FAIL',
    expected,
    actual: response.status
  });
  assert.equal(response.status, expected, `${method} ${endpoint}: ${response.body.message || 'unexpected status'}`);
  return response;
}

before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { dbName: 'student_management_api_test' } });
  const isolatedUri = mongo.getUri();
  assert.match(isolatedUri, /^mongodb:\/\/(127\.0\.0\.1|localhost):/, 'Tests must use the isolated in-memory MongoDB instance.');
  await mongoose.connect(isolatedUri, { dbName: 'student_management_api_test' });
  await Promise.all([Student.init(), Department.init()]);
  department = await Department.create({
    name: `API Test Department ${unique}`,
    sections: ['A', 'B']
  });
});

after(async () => {
  console.log('\nStudent API test report');
  console.log('| API | Method | Result | Expected | Actual |');
  console.log('| --- | --- | --- | ---: | ---: |');
  for (const row of report) {
    console.log(`| ${row.api} | ${row.method} | ${row.result} | ${row.expected} | ${row.actual} |`);
  }
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test('student CRUD APIs and validation use an isolated database', async (t) => {
  await t.test('Add student', async () => {
    const response = await expectStatus('Add student', 'POST', '/api/students', 201, () =>
      request(app).post('/api/students').send({ ...student, department: String(department._id) }));
    assert.equal(response.body.data.studentId, student.studentId);
    created = response.body.data;
  });

  await t.test('View all students includes the new record', async () => {
    if (!created) return t.skip('Add student did not create a record.');
    const response = await expectStatus('View all students', 'GET', '/api/students', 200, () =>
      request(app).get('/api/students'));
    assert.ok(response.body.data.some((item) => item._id === created._id));
  });

  await t.test('Retrieve student by MongoDB ID', async () => {
    if (!created) return t.skip('Add student did not create a record.');
    const response = await expectStatus('Retrieve student by ID', 'GET', '/api/students/:id', 200, () =>
      request(app).get(`/api/students/${created._id}`));
    assert.equal(response.body.data._id, created._id);
  });

  await t.test('Search students by unique roll number', async () => {
    const response = await expectStatus('Search students', 'GET', '/api/students?q=', 200, () =>
      request(app).get('/api/students').query({ q: student.studentId }));
    if (created) assert.ok(response.body.data.some((item) => item._id === created._id));
  });

  await t.test('Update student', async () => {
    if (!created) return t.skip('Add student did not create a record.');
    const response = await expectStatus('Update student', 'PUT', '/api/students/:id', 200, () =>
      request(app).put(`/api/students/${created._id}`).send({ name: 'Updated API Test Student', section: 'B', semester: 2 }));
    assert.equal(response.body.data.name, 'Updated API Test Student');
    assert.equal(response.body.data.section, 'B');
    assert.equal(response.body.data.semester, 2);
  });

  await t.test('Reject missing required student fields', async () => {
    await expectStatus('Missing required fields', 'POST', '/api/students', 400, () =>
      request(app).post('/api/students').send({ department: String(department._id) }));
  });

  await t.test('Return not found for an invalid student identifier', async () => {
    await expectStatus('Invalid student ID', 'GET', '/api/students/:id', 404, () =>
      request(app).get('/api/students/invalid-id!'));
  });

  await t.test('Reject duplicate student ID', async () => {
    await expectStatus('Duplicate student ID', 'POST', '/api/students', 409, () =>
      request(app).post('/api/students').send({
        ...student,
        email: `duplicate-roll-${unique.toLowerCase()}@example.test`,
        department: String(department._id)
      }));
  });

  await t.test('Reject duplicate email address', async () => {
    await expectStatus('Duplicate email address', 'POST', '/api/students', 409, () =>
      request(app).post('/api/students').send({
        ...student,
        studentId: `DUP${unique.slice(0, 12)}`,
        department: String(department._id)
      }));
  });

  await t.test('Reject invalid department ID', async () => {
    await expectStatus('Invalid department ID', 'POST', '/api/students', 400, () =>
      request(app).post('/api/students').send({
        ...student,
        studentId: `DEPT${unique.slice(0, 11)}`,
        email: `invalid-dept-${unique.toLowerCase()}@example.test`,
        department: 'not-a-mongodb-id'
      }));
  });

  await t.test('Return not found for an unknown valid MongoDB student ID', async () => {
    const missingId = new mongoose.Types.ObjectId().toString();
    await expectStatus('Student not found', 'GET', '/api/students/:id', 404, () =>
      request(app).get(`/api/students/${missingId}`));
  });

  await t.test('Delete student', async () => {
    if (!created) return t.skip('Add student did not create a record.');
    await expectStatus('Delete student', 'DELETE', '/api/students/:id', 200, () =>
      request(app).delete(`/api/students/${created._id}`));
  });

  await t.test('Verify deleted student no longer exists', async () => {
    if (!created) return t.skip('Add student did not create a record.');
    await expectStatus('Verify deleted student', 'GET', '/api/students/:id', 404, () =>
      request(app).get(`/api/students/${created._id}`));
  });
});
