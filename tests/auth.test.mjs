import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { OTP_LENGTH, cleanCode, passwordChecks, isPasswordValid, passwordStrength, formatCountdown, throttleSeconds, friendlyAuthError } = load('lib/auth');

test('cleanCode keeps digits only, keeps leading zeros and caps the length', () => {
  assert.equal(OTP_LENGTH, 6);
  assert.equal(cleanCode('012345'), '012345');
  assert.equal(cleanCode(' 12 34-56 '), '123456');
  assert.equal(cleanCode('1234567890'), '123456');
  assert.equal(cleanCode('abc'), '');
  assert.equal(cleanCode(null), '');
  assert.equal(cleanCode(undefined), '');
  assert.equal(cleanCode(123456), '123456');
  assert.equal(cleanCode('987654321', 4), '9876');
});

test('passwordChecks / isPasswordValid: only the length is required', () => {
  assert.deepEqual(passwordChecks('Abcdef1!'), { length: true, number: true, upper: true, symbol: true });
  assert.deepEqual(passwordChecks('abc'), { length: false, number: false, upper: false, symbol: false });
  assert.equal(isPasswordValid('abcdefgh'), true);
  assert.equal(isPasswordValid('abcdefg'), false);
  assert.equal(isPasswordValid(''), false);
});

test('passwordStrength fills 0-4 segments and never rates a too-short password above weak', () => {
  assert.deepEqual(passwordStrength(''), { score: 0, level: 'empty', label: '' });
  assert.deepEqual(passwordStrength('Ab1!'), { score: 1, level: 'weak', label: 'Terlalu pendek' });
  assert.deepEqual(passwordStrength('abcdefgh'), { score: 1, level: 'weak', label: 'Lemah' });
  assert.deepEqual(passwordStrength('abcdefg1'), { score: 2, level: 'fair', label: 'Cukup' });
  assert.deepEqual(passwordStrength('Abcdefg1'), { score: 3, level: 'good', label: 'Kuat' });
  assert.deepEqual(passwordStrength('Abcdef1!'), { score: 4, level: 'strong', label: 'Sangat kuat' });
});

test('formatCountdown renders m:ss and never goes negative', () => {
  assert.equal(formatCountdown(60), '1:00');
  assert.equal(formatCountdown(75), '1:15');
  assert.equal(formatCountdown(9), '0:09');
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(-3), '0:00');
  assert.equal(formatCountdown(41.2), '0:42');
  assert.equal(formatCountdown(NaN), '0:00');
});

test('throttleSeconds reads the wait time out of the Supabase rate-limit message', () => {
  assert.equal(throttleSeconds('For security purposes, you can only request this after 42 seconds.'), 42);
  assert.equal(throttleSeconds('For security purposes, you can only request this after 1 second.'), 1);
  assert.equal(throttleSeconds('Token has expired or is invalid'), null);
  assert.equal(throttleSeconds(undefined), null);
});

test('friendlyAuthError explains the errors a client can actually hit', () => {
  assert.equal(friendlyAuthError('Invalid login credentials'), 'Email atau password salah.');
  assert.equal(friendlyAuthError('Token has expired or is invalid'), 'Kode salah atau sudah kedaluwarsa. Periksa kembali kodenya atau minta kode baru.');
  assert.equal(friendlyAuthError('Email link is invalid or has expired'), 'Kode salah atau sudah kedaluwarsa. Periksa kembali kodenya atau minta kode baru.');
  assert.equal(friendlyAuthError('For security purposes, you can only request this after 42 seconds.'), 'Tunggu 42 detik sebelum meminta kode lagi.');
  assert.equal(friendlyAuthError('email rate limit exceeded'), 'Terlalu sering meminta. Tunggu beberapa menit lalu coba lagi.');
  assert.equal(friendlyAuthError('New password should be different from the old password.'), 'Password baru harus berbeda dari password lama.');
  assert.equal(friendlyAuthError('Password is known to be weak and easy to guess, please choose a different one.'), 'Password terlalu mudah ditebak. Gunakan kombinasi yang lebih unik.');
  assert.equal(friendlyAuthError('Auth session missing!'), 'Sesi reset sudah berakhir. Mulai lagi dari Lupa password.');
  assert.equal(friendlyAuthError('Error sending recovery email'), 'Pengiriman email belum diaktifkan oleh admin (SMTP). Hubungi admin.');
  assert.equal(friendlyAuthError('Failed to fetch'), 'Koneksi bermasalah. Periksa internet lalu coba lagi.');
  assert.equal(friendlyAuthError('Something unexpected'), 'Something unexpected');
  assert.equal(friendlyAuthError(undefined), '');
});
